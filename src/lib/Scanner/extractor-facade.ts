/**
 * ExtractorFacade - Entity/relation extraction pipeline
 * 
 * Extracts entities, relations, triples, and temporal mentions from documents.
 * Persists results to CozoDB. All heavy lifting is in Rust/WASM.
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
import {
    conductorBridge,
    type ScanResult,
    type EntityDefinition
} from './bridge';

// Persistence layers
import { persistTemporalMentions, clearTemporalMentions } from './temporal-persistence';
import { fullGraphSync } from '@/lib/graph/graph-sync';

import { regexEntityParser } from '@/lib/utils/regex-entity-parser';
import type { DocumentConnections, EntityReference, Triple } from '@/lib/types/entityTypes';

// Track last scanned text for context extraction
const lastScannedText = new Map<string, string>();

class ExtractorFacade {
    private initialized = false;

    private get activeScanner() {
        return conductorBridge;
    }

    /**
     * Initialize the Rust scanner and wire up persistence
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Initialize WASM
        await this.activeScanner.initialize();

        // Hydrate with registered entities
        const entities = await entityRegistry.getAllEntities();
        const defs: EntityDefinition[] = entities.map(e => ({
            id: e.id,
            label: e.label,
            kind: e.kind,
            aliases: e.aliases || [],
        }));
        await this.activeScanner.hydrateEntities(defs);

        // Wire up persistence handlers
        this.activeScanner.onResult(async (noteId, result) => {
            if (result.stats.was_skipped) return;

            // Persist temporal mentions
            if (result.temporal && result.temporal.length > 0) {
                const fullText = lastScannedText.get(noteId) || '';
                await clearTemporalMentions(noteId);
                await persistTemporalMentions(noteId, result.temporal, fullText);
            }

            // Persist unified relations (CST + Graph inference - NEW PIPELINE)
            const unifiedRelations = (result as any).unified_relations;
            if (unifiedRelations && unifiedRelations.length > 0) {
                const inputs = unifiedRelations
                    .map((rel: any) => {
                        const head = entityRegistry.findEntityByLabel(rel.head);
                        const tail = entityRegistry.findEntityByLabel(rel.tail);
                        if (!head || !tail) return null;

                        // Map source type to RelationshipSource
                        const source = rel.source === 'CST'
                            ? RelationshipSource.NER_EXTRACTION  // CST extraction
                            : RelationshipSource.NER_EXTRACTION; // Graph inference (same for now)

                        return {
                            sourceEntityId: head.id,
                            targetEntityId: tail.id,
                            type: rel.relation_type,
                            provenance: [{
                                source,
                                originId: noteId,
                                confidence: rel.confidence,
                                timestamp: new Date()
                            }]
                        };
                    })
                    .filter((input: any): input is NonNullable<typeof input> => input !== null);

                if (inputs.length > 0) {
                    const persistedCount = relationshipRegistry.addBatch(inputs);
                    if (persistedCount > 0) {
                        console.log(`[Extractor] Persisted ${persistedCount}/${unifiedRelations.length} unified relations (CST+Graph)`);
                    }
                }
            }

            // Legacy: Persist old-style relations (now deprecated, usually empty)
            if (result.relations && result.relations.length > 0) {
                // Pre-resolve all entity labels to IDs
                const inputs = result.relations
                    .map(rel => {
                        const head = entityRegistry.findEntityByLabel(rel.head_entity);
                        const tail = entityRegistry.findEntityByLabel(rel.tail_entity);
                        if (!head || !tail) return null;
                        return {
                            sourceEntityId: head.id,
                            targetEntityId: tail.id,
                            type: rel.relation_type,
                            provenance: [{
                                source: RelationshipSource.NER_EXTRACTION,
                                originId: noteId,
                                confidence: rel.confidence,
                                timestamp: new Date()
                            }]
                        };
                    })
                    .filter((input): input is NonNullable<typeof input> => input !== null);

                if (inputs.length > 0) {
                    const persistedCount = relationshipRegistry.addBatch(inputs);
                    if (persistedCount > 0) {
                        console.log(`[Extractor] Persisted ${persistedCount}/${result.relations.length} legacy relationships`);
                    }
                }
            }

            // Persist triples as unified relationships (explicit [X] (REL) [Y] syntax)
            // This auto-registers entities and creates relationships with highest confidence
            if (result.triples && result.triples.length > 0) {
                let triplesConverted = 0;
                for (const triple of result.triples) {
                    try {
                        // Cast to access optional source_kind/target_kind from Rust
                        const t = triple as any;
                        const sourceKind = t.source_kind || 'CONCEPT';
                        const targetKind = t.target_kind || 'CONCEPT';

                        // Auto-register entities from explicit syntax
                        const sourceResult = await entityRegistry.registerEntity(
                            triple.source,
                            sourceKind,
                            noteId,
                            { source: 'extraction' }
                        );
                        const targetResult = await entityRegistry.registerEntity(
                            triple.target,
                            targetKind,
                            noteId,
                            { source: 'extraction' }
                        );

                        // Create unified relationship
                        relationshipRegistry.add({
                            sourceEntityId: sourceResult.entity.id,
                            targetEntityId: targetResult.entity.id,
                            type: triple.predicate,
                            provenance: [{
                                source: RelationshipSource.EXPLICIT_SYNTAX,
                                originId: noteId,
                                confidence: 1.0, // Explicit syntax = highest confidence
                                timestamp: new Date(),
                            }]
                        });
                        triplesConverted++;
                    } catch (err) {
                        console.warn(`[Extractor] Failed to convert triple: ${triple.source} -> ${triple.predicate} -> ${triple.target}`, err);
                    }
                }
                if (triplesConverted > 0) {
                    console.log(`[Extractor] Converted ${triplesConverted}/${result.triples.length} triples → relationships`);
                }
            }

            // Log all extraction results
            const stats = result.stats as any;
            console.log(`[Extractor] Extraction complete:`, {
                implicit: stats.implicit_found,
                unified: stats.unified_found || 0,
                triples: stats.triples_found,
                temporal: stats.temporal_found,
                time_us: stats.timings?.total_us,
            });

            // Log unified relation details if any found
            if (unifiedRelations && unifiedRelations.length > 0) {
                console.log(`[Extractor] Unified Relations:`, unifiedRelations.map((r: any) =>
                    `${r.head} -[${r.relation_type}]-> ${r.tail} (${r.source})`
                ));
            }

            // Sync graph data to CozoDB (Evolution 3.0)
            try {
                const syncResult = await fullGraphSync(result, {
                    groupId: 'vault:global',
                    noteId,
                });
                if (syncResult.entitiesSynced > 0 || syncResult.edgesSynced > 0) {
                    console.log(`[Extractor] Graph synced:`, {
                        entities: syncResult.entitiesSynced,
                        edges: syncResult.edgesSynced,
                        relations: syncResult.relationsSynced,
                        ms: syncResult.durationMs,
                    });
                }
            } catch (err) {
                console.warn('[Extractor] Graph sync failed:', err);
            }
        });

        this.initialized = true;
        console.log(`[Extractor] Initialized with ${defs.length} entities`);
    }

    /**
     * Hydrate with entities (call when entities change)
     */
    async hydrateEntities(entities: EntityDefinition[]): Promise<void> {
        if (!this.initialized) {
            return;  // Silent return - will be called again when ready
        }
        await this.activeScanner.hydrateEntities(entities);
        console.log(`[Extractor] Re-hydrated with ${entities.length} entities`);
    }

    /**
     * Hydrate temporal patterns from a calendar
     */
    async hydrateTemporal(calendarId: string): Promise<void> {
        if (!this.initialized) return;
        const dictionary = TimeRegistry.getCalendarDictionary(calendarId);
        await this.activeScanner.hydrateCalendar(dictionary);
    }

    /**
     * Scan a document (debounced)
     */
    scan(noteId: string, text: string): void {
        if (!this.initialized) {
            return;  // Silent return - will be called again when ready
        }
        lastScannedText.set(noteId, text);
        this.activeScanner.scan(noteId, text, []);
    }

    /**
     * Scan immediately (bypasses debounce)
     */
    scanImmediate(noteId: string, text: string): ScanResult | null {
        if (!this.initialized) return null;
        lastScannedText.set(noteId, text);
        return this.activeScanner.scanImmediate(noteId, text, []);
    }

    /**
     * Register a result handler
     */
    onResult(handler: (noteId: string, result: ScanResult) => void): () => void {
        return this.activeScanner.onResult(handler);
    }

    /**
     * Check if ready
     */
    isReady(): boolean {
        return this.initialized && this.activeScanner.isReady();
    }

    /**
     * Shutdown
     */
    shutdown(): void {
        this.activeScanner.shutdown();
        this.initialized = false;
        console.log('[Extractor] Shutdown');
    }
}

// Singleton (exported as both names for migration)
export const extractorFacade = new ExtractorFacade();
/** @deprecated Use extractorFacade instead */
export const scannerFacade = extractorFacade;

// =============================================================================
// Legacy Utilities (Migrated)
// =============================================================================

/**
 * Parse connections (tags, mentions, links) from a document
 * Uses ExtractorFacade (Rust) + RegexEntityParser (Utils)
 */
export function parseNoteConnectionsFromDocument(content: any): DocumentConnections {
    const text = extractText(content);
    const noteId = 'temp'; // We just want the connections

    const entities: EntityReference[] = [];
    const triples: Triple[] = [];
    const wikilinks: string[] = [];
    const tags: string[] = [];
    const mentions: string[] = [];

    // 1. Explicit Entities ([KIND|Label])
    const explicitEntities = regexEntityParser.parseFromText(text);
    for (const entity of explicitEntities) {
        entities.push({
            kind: entity.kind,
            label: entity.label,
            subtype: entity.subtype,
            attributes: entity.metadata
        });
    }

    // 2. Implicit Entities & Triples (Rust Scanner)
    // Safe fallback: Only run if scanner is ready. If not, we just return explicit entities.
    if (extractorFacade.isReady()) {
        const scanResult = extractorFacade.scanImmediate(noteId, text);
        if (scanResult) {
            // Implicit Mentions
            for (const mention of scanResult.implicit) {
                // Avoid duplicates with explicit entities
                const exists = entities.some(e => e.label === mention.entity_label && e.kind === mention.entity_kind);
                if (!exists) {
                    entities.push({
                        kind: mention.entity_kind as any,
                        label: mention.entity_label,
                    });
                }
            }

            // Triples
            for (const triple of scanResult.triples) {
                triples.push({
                    subject: { label: triple.source, kind: 'CONCEPT' },
                    predicate: triple.predicate,
                    object: { label: triple.target, kind: 'CONCEPT' }
                });
            }
        }
    }

    // 3. Regex for WikiLinks, Tags, Mentions (Legacy patterns)
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    const tagRegex = /#([\w-]+)/g;
    const mentionRegex = /@([\w-]+)/g;

    let match;
    while ((match = linkRegex.exec(text)) !== null) {
        wikilinks.push(match[1]);
    }
    while ((match = tagRegex.exec(text)) !== null) {
        tags.push(match[1]);
    }
    while ((match = mentionRegex.exec(text)) !== null) {
        mentions.push(match[1]);
    }

    return {
        tags,
        mentions,
        links: [],
        wikilinks,
        entities,
        triples,
        backlinks: []
    };
}

/**
 * Extract plain text from TipTap JSONContent
 */
function extractText(node: any): string {
    if (!node) return '';
    if (typeof node === 'string') return node;

    if (node.type === 'text' && node.text) {
        return node.text;
    }

    if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractText).join('\n');
    }

    return '';
}
