/**
 * ScannerFacade - Minimal TypeScript wrapper for Rust DocumentCortex
 * 
 * This is the ONLY public scanner API. All heavy lifting is in Rust/WASM.
 * Target: ~50 lines of code (excluding types/comments)
 */

import { entityRegistry, relationshipRegistry, RelationshipSource } from '@/lib/cozo/graph/adapters';
import { TimeRegistry } from '@/lib/time';

// Re-export types for consumers
export type {
    ScanResult,
    ExtractedRelation,
    ExtractedTriple,
    ImplicitMention,
    TemporalMention,
    EntityDefinition,
    EntitySpan,
} from './bridge';

// Import the actual Rust bridge
import { rustScanner, type ScanResult, type EntityDefinition } from './bridge';

// Persistence layers
import { persistTemporalMentions, clearTemporalMentions } from './temporal-persistence';

// Track last scanned text for context extraction
const lastScannedText = new Map<string, string>();

class ScannerFacade {
    private initialized = false;

    /**
     * Initialize the Rust scanner and wire up persistence
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Initialize WASM
        await rustScanner.initialize();

        // Hydrate with registered entities
        const entities = await entityRegistry.getAllEntities();
        const defs: EntityDefinition[] = entities.map(e => ({
            id: e.id,
            label: e.label,
            kind: e.kind,
            aliases: e.aliases || [],
        }));
        await rustScanner.hydrateEntities(defs);

        // Wire up persistence handlers
        rustScanner.onResult(async (noteId, result) => {
            if (result.stats.was_skipped) return;

            // Persist temporal mentions
            if (result.temporal && result.temporal.length > 0) {
                const fullText = lastScannedText.get(noteId) || '';
                await clearTemporalMentions(noteId);
                await persistTemporalMentions(noteId, result.temporal, fullText);
            }

            // Persist extracted relationships
            if (result.relations && result.relations.length > 0) {
                let persistedCount = 0;
                for (const rel of result.relations) {
                    // Resolve labels to IDs
                    const head = entityRegistry.findEntityByLabel(rel.head_entity);
                    const tail = entityRegistry.findEntityByLabel(rel.tail_entity);

                    if (head && tail) {
                        try {
                            relationshipRegistry.add({
                                sourceEntityId: head.id,
                                targetEntityId: tail.id,
                                type: rel.relation_type,
                                provenance: [{
                                    source: RelationshipSource.NER_EXTRACTION,
                                    originId: noteId,
                                    confidence: rel.confidence,
                                    timestamp: new Date()
                                }]
                            });
                            persistedCount++;
                        } catch (err) {
                            console.warn('[ScannerFacade] Failed to persist relation:', rel, err);
                        }
                    }
                }
                if (persistedCount > 0) {
                    console.log(`[ScannerFacade] Persisted ${persistedCount}/${result.relations.length} relationships`);
                }
            }

            // Log all extraction results
            console.log(`[ScannerFacade] Scan complete:`, {
                implicit: result.stats.implicit_found,
                relations: result.stats.relations_found,
                triples: result.stats.triples_found,
                temporal: result.stats.temporal_found,
                time_us: result.stats.timings?.total_us,
            });

            // Log relation details if any found
            if (result.relations && result.relations.length > 0) {
                console.log(`[ScannerFacade] Relations:`, result.relations.map(r =>
                    `${r.head_entity} -[${r.relation_type}]-> ${r.tail_entity}`
                ));
            }
        });

        this.initialized = true;
        console.log('[ScannerFacade] Initialized with', defs.length, 'entities');
    }

    /**
     * Hydrate with entities (call when entities change)
     */
    async hydrateEntities(entities: EntityDefinition[]): Promise<void> {
        if (!this.initialized) {
            console.warn('[ScannerFacade] Not initialized, cannot hydrate entities');
            return;
        }
        await rustScanner.hydrateEntities(entities);
        console.log(`[ScannerFacade] Re-hydrated with ${entities.length} entities`);
    }

    /**
     * Hydrate temporal patterns from a calendar
     */
    async hydrateTemporal(calendarId: string): Promise<void> {
        if (!this.initialized) return;
        const dictionary = TimeRegistry.getCalendarDictionary(calendarId);
        await rustScanner.hydrateCalendar(dictionary);
    }

    /**
     * Scan a document (debounced)
     */
    scan(noteId: string, text: string): void {
        if (!this.initialized) {
            console.warn('[ScannerFacade] Not initialized, skipping scan');
            return;
        }
        lastScannedText.set(noteId, text);
        rustScanner.scan(noteId, text, []);
    }

    /**
     * Scan immediately (bypasses debounce)
     */
    scanImmediate(noteId: string, text: string): ScanResult | null {
        if (!this.initialized) return null;
        lastScannedText.set(noteId, text);
        return rustScanner.scanImmediate(noteId, text, []);
    }

    /**
     * Register a result handler
     */
    onResult(handler: (noteId: string, result: ScanResult) => void): () => void {
        return rustScanner.onResult(handler);
    }

    /**
     * Check if ready
     */
    isReady(): boolean {
        return this.initialized && rustScanner.isReady();
    }

    /**
     * Shutdown
     */
    shutdown(): void {
        rustScanner.shutdown();
        this.initialized = false;
        console.log('[ScannerFacade] Shutdown');
    }
}

// Singleton
export const scannerFacade = new ScannerFacade();
