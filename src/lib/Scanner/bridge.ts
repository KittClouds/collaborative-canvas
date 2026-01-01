/**
 * RustScanner - Thin TypeScript bridge to Rust DocumentCortex
 * 
 * This is the ONLY TypeScript file needed to use the unified Rust scanner.
 * All heavy lifting happens in WASM; this just handles:
 * - WASM initialization
 * - Entity hydration from EntityRegistry
 * - Debouncing (uses browser setTimeout)
 * - Routing results to persistence layers
 * 
 * @module scanner/bridge
 */

// =============================================================================
// Types
// =============================================================================

/** Entity definition for hydration (matches Rust EntityDefinition) */
export interface EntityDefinition {
    id: string;
    label: string;
    kind: string;
    aliases: string[];
}

/** Entity span for relationship extraction (matches Rust EntitySpan) */
export interface EntitySpan {
    label: string;
    start: number;
    end: number;
    kind?: string;
    entity_id?: string;
}

/** Timing statistics from scan */
export interface ScanTimings {
    total_us: number;
    syntax_us: number;
    relation_us: number;
    temporal_us: number;
    implicit_us: number;
    triple_us: number;
}

/** Aggregate scan statistics */
export interface ScanStats {
    timings: ScanTimings;
    content_hash: number;
    was_skipped: boolean;
    entities_found: number;
    relations_found: number;
    temporal_found: number;
    implicit_found: number;
    triples_found: number;
}

/** Extracted relation from Rust */
export interface ExtractedRelation {
    head_entity: string;
    head_start: number;
    head_end: number;
    tail_entity: string;
    tail_start: number;
    tail_end: number;
    relation_type: string;
    pattern_matched: string;
    pattern_start: number;
    pattern_end: number;
    confidence: number;
}

/** Extracted triple from Rust */
export interface ExtractedTriple {
    source: string;
    predicate: string;
    target: string;
    start: number;
    end: number;
    raw_text: string;
}

/** Implicit entity mention from Rust */
export interface ImplicitMention {
    entity_id: string;
    entity_label: string;
    entity_kind: string;
    matched_text: string;
    start: number;
    end: number;
    is_alias_match: boolean;
}

/** Unified scan result from Rust DocumentCortex */
export interface ScanResult {
    relations: ExtractedRelation[];
    implicit: ImplicitMention[];
    triples: ExtractedTriple[];
    stats: ScanStats;
    errors: Array<{ phase: string; message: string }>;
    temporal?: TemporalMention[];
}

/** Temporal metadata (matches Rust TemporalMetadata) */
export interface TemporalMetadata {
    weekday_index?: number;
    month_index?: number;
    narrative_number?: number;
    direction?: string;
    era_year?: number;
    era_name?: string;
}

/** Temporal mention (matches Rust TemporalMention) */
export interface TemporalMention {
    kind: string;
    text: string;
    start: number;
    end: number;
    confidence: number;
    metadata?: TemporalMetadata;
}

/** Calendar dictionary for hydration */
export interface CalendarDictionary {
    // Note: Rust hydrate_calendar takes 3 args: months, weekdays, eras.
    // We pass this object to the bridge, which spreads it.
    months: string[];
    weekdays: string[];
    eras: string[];
}

// =============================================================================
// Configuration
// =============================================================================

export interface RustScannerConfig {
    /** Debounce delay in milliseconds */
    debounceMs: number;
    /** Whether to log performance metrics */
    logPerformance: boolean;
    /** Threshold in ms to warn about slow scans */
    slowScanThresholdMs: number;
}

const DEFAULT_CONFIG: RustScannerConfig = {
    debounceMs: 300,
    logPerformance: true,
    slowScanThresholdMs: 50,
};

// =============================================================================
// RustScanner Class
// =============================================================================

/**
 * Thin bridge to Rust DocumentCortex
 */
export class RustScanner {
    private cortex: any | null = null; // Will be DocumentCortex when WASM is loaded
    private isInitialized = false;
    private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private config: RustScannerConfig;
    private resultHandlers: Array<(noteId: string, result: ScanResult) => void> = [];

    constructor(config: Partial<RustScannerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize WASM and create DocumentCortex instance
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Dynamic import of WASM module
            const wasm = await import(
                /* webpackIgnore: true */
                '@kittcore/wasm'
            );
            await wasm.default(); // Initialize WASM
            this.cortex = new wasm.DocumentCortex();
            this.isInitialized = true;
            console.log('[RustScanner] Initialized');
        } catch (error) {
            console.error('[RustScanner] Failed to initialize WASM:', error);
            throw error;
        }
    }

    /**
     * Check if scanner is ready
     */
    isReady(): boolean {
        return this.isInitialized && this.cortex !== null;
    }

    /**
     * Hydrate with entities for implicit mention detection
     */
    async hydrateEntities(entities: EntityDefinition[]): Promise<void> {
        if (!this.cortex) throw new Error('RustScanner not initialized');
        try {
            this.cortex.hydrateEntities(entities);
        } catch (error) {
            console.error('[RustScanner] Failed to hydrate entities:', error);
            throw error;
        }
    }

    /**
     * Hydrate with calendar data for custom temporal patterns
     */
    async hydrateCalendar(dictionary: CalendarDictionary): Promise<void> {
        if (!this.cortex) throw new Error('RustScanner not initialized');
        try {
            this.cortex.hydrateCalendar(dictionary.months, dictionary.weekdays, dictionary.eras);
        } catch (error) {
            console.error('[RustScanner] Failed to hydrate calendar:', error);
            throw error;
        }
    }

    /**
     * Register a result handler (called after each scan)
     */
    onResult(handler: (noteId: string, result: ScanResult) => void): () => void {
        this.resultHandlers.push(handler);
        return () => {
            const idx = this.resultHandlers.indexOf(handler);
            if (idx >= 0) this.resultHandlers.splice(idx, 1);
        };
    }

    /**
     * Scan a document (debounced)
     */
    scan(noteId: string, text: string, entitySpans: EntitySpan[] = []): void {
        const existing = this.debounceTimers.get(noteId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
            this.executeScan(noteId, text, entitySpans);
            this.debounceTimers.delete(noteId);
        }, this.config.debounceMs);

        this.debounceTimers.set(noteId, timer);
    }

    /**
     * Execute scan immediately (bypasses debounce)
     */
    scanImmediate(noteId: string, text: string, entitySpans: EntitySpan[] = []): ScanResult | null {
        return this.executeScan(noteId, text, entitySpans);
    }

    /**
     * Internal scan execution
     */
    private executeScan(noteId: string, text: string, entitySpans: EntitySpan[]): ScanResult | null {
        if (!this.cortex) return null;

        try {
            const result = this.cortex.scan(text, entitySpans) as ScanResult;

            if (!result || !result.stats) {
                console.warn('[RustScanner] WASM returned null result');
                return null;
            }

            if (this.config.logPerformance && !result.stats.was_skipped) {
                const totalMs = result.stats.timings.total_us / 1000;
                if (totalMs > this.config.slowScanThresholdMs) {
                    console.warn(`[RustScanner] Slow scan: ${totalMs.toFixed(1)}ms`);
                }
            }

            for (const handler of this.resultHandlers) {
                try {
                    handler(noteId, result);
                } catch (e) {
                    console.error('[RustScanner] Handler error:', e);
                }
            }

            return result;
        } catch (error) {
            console.error('[RustScanner] Scan failed:', error);
            return null;
        }
    }

    /**
     * Use skipRate from Rust
     */
    getSkipRate(): number {
        return this.cortex?.skipRate() ?? 0;
    }

    /**
     * Shutdown scanner
     */
    shutdown(): void {
        for (const timer of this.debounceTimers.values()) clearTimeout(timer);
        this.debounceTimers.clear();
        this.resultHandlers = [];
        this.cortex = null;
        this.isInitialized = false;
    }
}

/** Singleton RustScanner instance */
export const rustScanner = new RustScanner();
