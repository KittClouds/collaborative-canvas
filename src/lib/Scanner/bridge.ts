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
// ConductorBridge - Wrapper for Rust ScanConductor
// =============================================================================

/**
 * ConductorBridge - Wrapper for Rust ScanConductor
 * 
 * Key differences from RustScanner:
 * 1. Built-in ready-signal: `scan()` returns null until hydrated
 * 2. `onReady()` callback fires when init + hydration complete
 * 3. State machine: Uninitialized → Initialized → Ready
 */
export class ConductorBridge {
    private conductor: any = null; // Will be ScanConductor when WASM loaded
    private ready = false;
    private readyCallbacks: Array<() => void> = [];
    private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private resultHandlers: Array<(noteId: string, result: ScanResult) => void> = [];
    private config: RustScannerConfig;

    constructor(config: Partial<RustScannerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize WASM and create ScanConductor instance
     */
    async initialize(): Promise<void> {
        if (this.conductor) return;

        try {
            const wasm = await import(
                /* webpackIgnore: true */
                '@kittcore/wasm'
            );
            await wasm.default();
            this.conductor = new wasm.ScanConductor();
            this.conductor.init();
            console.log('[ConductorBridge] Initialized, state:', this.conductor.stateName());
        } catch (error) {
            console.error('[ConductorBridge] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Check if fully ready (initialized + hydrated)
     */
    isReady(): boolean {
        return this.ready && this.conductor?.isReady();
    }

    /**
     * Get current state name
     */
    getStateName(): string {
        return this.conductor?.stateName() ?? 'not-initialized';
    }

    /**
     * Subscribe to ready event (fires once after first hydration)
     */
    onReady(callback: () => void): () => void {
        if (this.ready) {
            // Already ready, fire immediately
            callback();
        } else {
            this.readyCallbacks.push(callback);
        }
        return () => {
            const idx = this.readyCallbacks.indexOf(callback);
            if (idx >= 0) this.readyCallbacks.splice(idx, 1);
        };
    }

    /**
     * Hydrate entities. Marks conductor as Ready and fires onReady callbacks.
     */
    async hydrateEntities(entities: EntityDefinition[]): Promise<void> {
        if (!this.conductor) {
            await this.initialize();
        }
        try {
            this.conductor.hydrateEntities(entities);
            console.log(`[ConductorBridge] Hydrated ${entities.length} entities, state:`, this.conductor.stateName());

            if (!this.ready && this.conductor.isReady()) {
                this.ready = true;
                for (const cb of this.readyCallbacks) {
                    try { cb(); } catch (e) { console.warn('[ConductorBridge] Ready callback error:', e); }
                }
                this.readyCallbacks = [];
            }
        } catch (error) {
            console.error('[ConductorBridge] Hydration failed:', error);
            throw error;
        }
    }

    /**
     * Hydrate calendar patterns
     */
    async hydrateCalendar(dictionary: CalendarDictionary): Promise<void> {
        if (!this.conductor) await this.initialize();
        try {
            this.conductor.hydrateCalendar(dictionary.months, dictionary.weekdays, dictionary.eras);
        } catch (error) {
            console.error('[ConductorBridge] Calendar hydration failed:', error);
        }
    }

    /**
     * Register result handler
     */
    onResult(handler: (noteId: string, result: ScanResult) => void): () => void {
        this.resultHandlers.push(handler);
        return () => {
            const idx = this.resultHandlers.indexOf(handler);
            if (idx >= 0) this.resultHandlers.splice(idx, 1);
        };
    }

    /**
     * Scan (debounced). Returns early if not ready.
     */
    scan(noteId: string, text: string, entitySpans: EntitySpan[] = []): void {
        if (!this.ready) {
            console.log('[ConductorBridge] Scan skipped - not ready');
            return;
        }

        const existing = this.debounceTimers.get(noteId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
            this.executeScan(noteId, text, entitySpans);
            this.debounceTimers.delete(noteId);
        }, this.config.debounceMs);

        this.debounceTimers.set(noteId, timer);
    }

    /**
     * Immediate scan (bypasses debounce)
     */
    scanImmediate(noteId: string, text: string, entitySpans: EntitySpan[] = []): ScanResult | null {
        return this.executeScan(noteId, text, entitySpans);
    }

    private executeScan(noteId: string, text: string, entitySpans: EntitySpan[]): ScanResult | null {
        if (!this.conductor) return null;

        try {
            // ScanConductor.scan returns null if not ready
            const result = this.conductor.scan(text, entitySpans) as ScanResult | null;

            if (!result) {
                console.log('[ConductorBridge] Scan returned null (not ready)');
                return null;
            }

            if (this.config.logPerformance && !result.stats.was_skipped) {
                const totalMs = result.stats.timings.total_us / 1000;
                if (totalMs > this.config.slowScanThresholdMs) {
                    console.warn(`[ConductorBridge] Slow scan: ${totalMs.toFixed(1)}ms`);
                }
            }

            for (const handler of this.resultHandlers) {
                try { handler(noteId, result); }
                catch (e) { console.error('[ConductorBridge] Handler error:', e); }
            }

            return result;
        } catch (error) {
            console.error('[ConductorBridge] Scan error:', error);
            return null;
        }
    }

    /**
     * Shutdown
     */
    shutdown(): void {
        for (const timer of this.debounceTimers.values()) clearTimeout(timer);
        this.debounceTimers.clear();
        this.resultHandlers = [];
        this.conductor?.reset();
        this.ready = false;
    }
}

/** Singleton ConductorBridge instance (only used when USE_CONDUCTOR = true) */
export const conductorBridge = new ConductorBridge();

