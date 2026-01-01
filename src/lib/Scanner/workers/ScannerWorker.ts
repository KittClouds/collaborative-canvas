/**
 * KittCore Scanner Worker
 * 
 * Web Worker that loads the KittCore WASM module and provides
 * a message-based API for document scanning.
 * 
 * @module scanner-v3/workers
 */

import type { RegisteredEntity } from '@/lib/cozo/graph/adapters/EntityRegistryAdapter';
import type { CalendarDictionary } from '@/lib/time';

// ==================== TYPE DEFINITIONS ====================

export interface ScannerWorkerMessage {
    type: 'INIT' | 'HYDRATE_ENTITIES' | 'HYDRATE_CALENDAR' | 'HYDRATE_RELATIONS' | 'SCAN' | 'SCAN_REFLEX' | 'SCAN_SYNTAX' | 'SCAN_TEMPORAL' | 'SCAN_RELATIONS' | 'GET_STATUS';
    payload?: unknown;
    requestId?: string;
}

export interface ScannerWorkerResponse {
    type: 'READY' | 'HYDRATED' | 'SCAN_RESULT' | 'STATUS' | 'ERROR';
    payload?: unknown;
    requestId?: string;
}

export interface EntityData {
    id: string;
    label: string;
    aliases: string[];
}

export interface CalendarData {
    months: string[];
    weekdays: string[];
    eras: string[];
}

export interface EntityMatch {
    entity_id: string;
    start: number;
    end: number;
    matched_text: string;
    match_type: string;
    confidence: number;
}

export interface SyntaxMatch {
    kind: string;
    start: number;
    end: number;
    content: string;
    captures: Record<string, string>;
}

export interface TemporalMention {
    kind: string;
    text: string;
    start: number;
    end: number;
    confidence: number;
    metadata?: {
        weekday_index?: number;
        month_index?: number;
        narrative_number?: number;
        direction?: string;
        era_year?: number;
        era_name?: string;
    };
}

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

export interface EntitySpan {
    label: string;
    entity_id?: string;
    start: number;
    end: number;
    kind?: string;
}

export interface ScanResult {
    entities: EntityMatch[];
    syntax: SyntaxMatch[];
    temporal: TemporalMention[];
    relations: ExtractedRelation[];
    stats: {
        total_time_ms: number;
        reflex_time_ms: number;
        syntax_time_ms: number;
        temporal_time_ms: number;
        relation_time_ms: number;
        text_length: number;
        entity_count: number;
        syntax_count: number;
        temporal_count: number;
        relation_count: number;
    };
}

export interface ScannerStatus {
    entities_hydrated: boolean;
    calendar_hydrated: boolean;
    relations_hydrated: boolean;
    reflex_ready: boolean;
    temporal_ready: boolean;
    relation_pattern_count: number;
    config: {
        enable_reflex: boolean;
        enable_syntax: boolean;
        enable_temporal: boolean;
        enable_relations: boolean;
        case_insensitive: boolean;
    };
}

// ==================== WORKER IMPLEMENTATION ====================

// Dynamic import types for WASM module
interface KittCoreModule {
    default: () => Promise<void>;
    DocumentScanner: new (config?: unknown) => DocumentScannerInstance;
    greet: (name: string) => string;
    version: () => string;
}

interface DocumentScannerInstance {
    hydrateEntities(entities: EntityData[]): void;
    hydrateCalendar(calendar: CalendarData): void;
    hydrateRelationPatterns(patterns: RelationPatternInput[]): void;
    scan(text: string): ScanResult;
    scanReflex(text: string): EntityMatch[];
    scanSyntax(text: string): SyntaxMatch[];
    scanTemporal(text: string): { mentions: TemporalMention[]; stats: { patterns_matched: number; scan_time_ms: number } };
    scanRelations(text: string, entitySpans: EntitySpan[]): ExtractedRelation[];
    containsEntities(text: string): boolean;
    getStatus(): string;
    getReflexStats(): unknown;
    getTemporalStats(): unknown;
    getRelationPatternCount(): number;
}

export interface RelationPatternInput {
    relation_type: string;
    patterns: string[];
    confidence?: number;
    bidirectional?: boolean;
}

let scanner: DocumentScannerInstance | null = null;
let isInitialized = false;

/**
 * Handle incoming messages from the main thread
 */
self.onmessage = async (event: MessageEvent<ScannerWorkerMessage>) => {
    const { type, payload, requestId } = event.data;

    try {
        switch (type) {
            case 'INIT': {
                await initializeScanner(payload as { config?: unknown });
                respond({ type: 'READY', requestId });
                break;
            }

            case 'HYDRATE_ENTITIES': {
                if (!scanner) {
                    throw new Error('Scanner not initialized. Call INIT first.');
                }

                const entities = payload as RegisteredEntity[];
                const entityData: EntityData[] = entities.map(e => ({
                    id: e.id,
                    label: e.label,
                    aliases: e.aliases || [],
                }));

                scanner.hydrateEntities(entityData);
                respond({ type: 'HYDRATED', payload: { type: 'entities', count: entityData.length }, requestId });
                break;
            }

            case 'HYDRATE_CALENDAR': {
                if (!scanner) {
                    throw new Error('Scanner not initialized. Call INIT first.');
                }

                const calendar = payload as CalendarDictionary;
                const calendarData: CalendarData = {
                    months: calendar.months || [],
                    weekdays: calendar.weekdays || [],
                    eras: calendar.eras || [],
                };

                scanner.hydrateCalendar(calendarData);
                respond({ type: 'HYDRATED', payload: { type: 'calendar' }, requestId });
                break;
            }

            case 'SCAN': {
                if (!scanner) {
                    throw new Error('Scanner not initialized. Call INIT first.');
                }

                const { text } = payload as { text: string };
                const result = scanner.scan(text);
                respond({ type: 'SCAN_RESULT', payload: result, requestId });
                break;
            }

            case 'SCAN_REFLEX': {
                if (!scanner) {
                    throw new Error('Scanner not initialized. Call INIT first.');
                }

                const { text } = payload as { text: string };
                const entities = scanner.scanReflex(text);
                respond({ type: 'SCAN_RESULT', payload: { entities }, requestId });
                break;
            }

            case 'SCAN_SYNTAX': {
                if (!scanner) {
                    throw new Error('Scanner not initialized. Call INIT first.');
                }

                const { text } = payload as { text: string };
                const syntax = scanner.scanSyntax(text);
                respond({ type: 'SCAN_RESULT', payload: { syntax }, requestId });
                break;
            }

            case 'SCAN_TEMPORAL': {
                if (!scanner) {
                    throw new Error('Scanner not initialized. Call INIT first.');
                }

                const { text } = payload as { text: string };
                const temporal = scanner.scanTemporal(text);
                respond({ type: 'SCAN_RESULT', payload: temporal, requestId });
                break;
            }

            case 'HYDRATE_RELATIONS': {
                if (!scanner) {
                    throw new Error('Scanner not initialized. Call INIT first.');
                }

                const patterns = payload as RelationPatternInput[];
                scanner.hydrateRelationPatterns(patterns);
                respond({ type: 'HYDRATED', payload: { type: 'relations', count: patterns.length }, requestId });
                break;
            }

            case 'SCAN_RELATIONS': {
                if (!scanner) {
                    throw new Error('Scanner not initialized. Call INIT first.');
                }

                const { text, entitySpans } = payload as { text: string; entitySpans: EntitySpan[] };
                const relations = scanner.scanRelations(text, entitySpans);
                respond({ type: 'SCAN_RESULT', payload: { relations }, requestId });
                break;
            }

            case 'GET_STATUS': {
                if (!scanner) {
                    respond({ type: 'STATUS', payload: { initialized: false }, requestId });
                    break;
                }

                const statusJson = scanner.getStatus();
                const status = JSON.parse(statusJson) as ScannerStatus;
                respond({ type: 'STATUS', payload: { initialized: true, ...status }, requestId });
                break;
            }

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        respond({ type: 'ERROR', payload: { error: errorMessage }, requestId });
    }
};

/**
 * Initialize the WASM scanner
 */
async function initializeScanner(options?: { config?: unknown }): Promise<void> {
    if (isInitialized) {
        console.log('[ScannerWorker] Already initialized');
        return;
    }

    console.log('[ScannerWorker] Initializing KittCore WASM...');

    // Dynamic import of WASM module
    const wasm = await import('@/lib/wasm/kittcore/kittcore') as KittCoreModule;
    await wasm.default();

    // Verify WASM is loaded
    console.log('[ScannerWorker]', wasm.greet('Worker'));
    console.log('[ScannerWorker] Version:', wasm.version());

    // Create scanner instance
    scanner = new wasm.DocumentScanner(options?.config);
    isInitialized = true;

    console.log('[ScannerWorker] Ready');
}

/**
 * Send response back to main thread
 */
function respond(message: ScannerWorkerResponse): void {
    self.postMessage(message);
}

// Export for TypeScript
export { };
