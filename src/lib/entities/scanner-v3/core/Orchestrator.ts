import { scannerEventBus } from './ScannerEventBus';
import { ChangeDetector, type DocumentChange } from './ChangeDetector';
import { patternExtractor } from '../extractors/PatternExtractor';
import { tripleExtractor, type ExtractedTriple } from '../extractors/TripleExtractor';
import { implicitEntityMatcher } from '../extractors/ImplicitEntityMatcher';
import { getRelationshipExtractor, type EntitySpan } from '../extractors/RelationshipExtractor';
import { nlpEnricher } from '../enrichers/NLPEnricher';
import { entityDisambiguator } from '../enrichers/EntityDisambiguator';
import type { EnrichedMatch } from '../enrichers/types';
import { entityRegistry } from '@/lib/cozo/graph/adapters';
import type { PatternMatchEvent, ScannerConfig } from '../types';

import { triplePersistence } from '../persistence/TriplePersistence';

// Limits to prevent memory issues
const MAX_ENTITIES_PER_SCAN = 100;
const MAX_TRIPLES_PER_SCAN = 50;
const MAX_IMPLICIT_MATCHES = 200;
const SLOW_OPERATION_THRESHOLD_MS = 100;

/**
 * Main Scanner 3.0 coordinator
 * Listens to pattern-matched events and orchestrates extraction
 */
export class ScannerOrchestrator {
    private config: ScannerConfig;
    private changeDetector: ChangeDetector;
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private isInitialized = false;

    constructor(config: Partial<ScannerConfig> = {}) {
        this.config = {
            debounceMs: 500,
            enableNLP: true, // Phase 7: enabled
            enableNeuroBERT: false,
            enableTriples: true,
            enableImplicitMatching: true,
            enableRelationshipInference: true, // Phase 7C: enabled
            relationshipConfidenceThreshold: 0.65,
            batchSize: 50,
            ...config,
        };
        this.changeDetector = new ChangeDetector();

        // Wire up persistence
        this.setTriplePersistence((triples, noteId) =>
            triplePersistence.persistTriples(triples, noteId)
        );
    }

    /**
     * Initialize scanner (subscribe to events)
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        scannerEventBus.on('pattern-matched', this.handlePatternMatch.bind(this));

        // Load relationship patterns from CoZo/Blueprint Hub
        if (this.config.enableRelationshipInference) {
            try {
                const relExtractor = getRelationshipExtractor();
                await relExtractor.loadPatternsFromCoZo();
                console.log('[Scanner 3.0] Relationship patterns loaded from CoZo');
            } catch (error) {
                console.warn('[Scanner 3.0] Failed to load CoZo patterns:', error);
            }
        }

        this.isInitialized = true;
        console.log('[Scanner 3.0] Initialized');
    }

    /**
     * Reload relationship patterns from CoZo/Blueprint Hub
     * Call this when patterns are updated in the UI
     */
    async reloadRelationshipPatterns(): Promise<void> {
        if (!this.config.enableRelationshipInference) return;

        try {
            const relExtractor = getRelationshipExtractor();
            await relExtractor.loadPatternsFromCoZo();
            console.log('[Scanner 3.0] Relationship patterns reloaded');
        } catch (error) {
            console.error('[Scanner 3.0] Failed to reload patterns:', error);
        }
    }

    /**
     * Handle pattern match event (from highlighter)
     */
    private handlePatternMatch(event: PatternMatchEvent): void {
        this.changeDetector.recordChange({
            from: event.position,
            to: event.position + event.length,
            text: event.fullMatch,
            noteId: event.noteId,
            timestamp: event.timestamp,
            context: event.context,
        });

        this.debounceScan(event.noteId);
    }

    /**
     * Debounce scan execution
     */
    private debounceScan(noteId: string): void {
        const existingTimer = this.debounceTimers.get(noteId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
            this.processPendingChanges(noteId);
            this.debounceTimers.delete(noteId);
        }, this.config.debounceMs);

        this.debounceTimers.set(noteId, timer);
    }

    /**
     * Log slow operations for debugging
     */
    private logPerformance(operation: string, startTime: number): void {
        const duration = performance.now() - startTime;
        if (duration > SLOW_OPERATION_THRESHOLD_MS) {
            console.warn(`[Scanner 3.0] Slow operation: ${operation} took ${duration.toFixed(1)}ms`);
        }
    }

    /**
     * Process all pending changes for a note
     */
    private async processPendingChanges(noteId: string): Promise<void> {
        const overallStart = performance.now();
        const changes = this.changeDetector.getPendingChanges(noteId);
        if (changes.length === 0) return;

        console.log(`[Scanner 3.0] Processing ${changes.length} changes for ${noteId}`);

        // 1. Extract and register entities
        try {
            const entityStart = performance.now();
            let entityEvents = changes.filter(c => c.text.match(/^\[([A-Z_]+)/));

            // Apply limit to prevent memory issues
            if (entityEvents.length > MAX_ENTITIES_PER_SCAN) {
                console.warn(`[Scanner 3.0] Too many entities (${entityEvents.length}), truncating to ${MAX_ENTITIES_PER_SCAN}`);
                entityEvents = entityEvents.slice(0, MAX_ENTITIES_PER_SCAN);
            }

            for (const change of entityEvents) {
                try {
                    let events = patternExtractor.extractEntities(change.text, noteId);

                    // NLP Enrichment
                    if (this.config.enableNLP && change.context) {
                        events = nlpEnricher.enrichMatches(events, change.context);
                    }

                    // Entity Disambiguation (Phase 7B)
                    let resolutions = new Map<string, string>();
                    if (this.config.enableNLP && events.length > 0) {
                        // Cast to EnrichedMatch[] as enrichment ensures this structure
                        resolutions = entityDisambiguator.disambiguateMatches(events as EnrichedMatch[]);
                    }

                    for (const event of events) {
                        const kind = event.captures.entityKind || 'CONCEPT';
                        const label = event.captures.label;
                        const subtype = event.captures.subtype;
                        const enriched = event as EnrichedMatch;
                        // Use finalConfidence if enriched, otherwise default
                        const confidence = enriched.finalConfidence || 1.0;

                        if (label) {
                            const mentionText = label;
                            const resolvedId = resolutions.get(mentionText.toLowerCase());

                            if (resolvedId) {
                                // Found a contextually resolved entity
                                const resolvedEntity = await entityRegistry.getEntityById(resolvedId);
                                if (resolvedEntity) {
                                    // Register using the resolved entity's canonical label
                                    // And ensure the current mention is added as an alias
                                    entityRegistry.registerEntity(resolvedEntity.label, kind as any, noteId, {
                                        subtype,
                                        attributes: {
                                            confidence,
                                            originalMention: mentionText
                                        },
                                        aliases: [mentionText] // Auto-alias
                                    });
                                    continue;
                                }
                            }

                            // Fallback to standard registration
                            entityRegistry.registerEntity(label, kind as any, noteId, {
                                subtype,
                                attributes: { confidence }, // Persist confidence
                            });
                        }
                    }
                } catch (entityError) {
                    console.error('[Scanner 3.0] Error extracting entity from:', change.text, entityError);
                }
            }

            this.logPerformance('Entity extraction', entityStart);
        } catch (error) {
            console.error('[Scanner 3.0] Entity extraction phase failed:', error);
        }

        // 2. Extract triples if enabled
        let extractedTriples: ExtractedTriple[] = [];
        if (this.config.enableTriples) {
            try {
                const tripleStart = performance.now();
                let tripleChanges = changes.filter(c => c.text.includes('->'));

                for (const change of tripleChanges) {
                    try {
                        const events = patternExtractor.extractTriples(change.text, noteId);
                        for (const event of events) {
                            const triple = tripleExtractor.parseTriple(event, change.text);
                            if (triple && tripleExtractor.validateTriple(triple)) {
                                extractedTriples.push(triple);
                            }
                        }
                    } catch (tripleError) {
                        console.error('[Scanner 3.0] Error extracting triple from:', change.text, tripleError);
                    }
                }

                // Apply limit
                if (extractedTriples.length > MAX_TRIPLES_PER_SCAN) {
                    console.warn(`[Scanner 3.0] Too many triples (${extractedTriples.length}), truncating to ${MAX_TRIPLES_PER_SCAN}`);
                    extractedTriples = extractedTriples.slice(0, MAX_TRIPLES_PER_SCAN);
                }

                this.logPerformance('Triple extraction', tripleStart);
            } catch (error) {
                console.error('[Scanner 3.0] Triple extraction phase failed:', error);
            }
        }

        // 3. Persist Triples
        if (this.persistTriplesHook && extractedTriples.length > 0) {
            try {
                const persistStart = performance.now();
                await this.persistTriplesHook(extractedTriples, noteId);
                this.logPerformance('Triple persistence', persistStart);
            } catch (error) {
                console.error('[Scanner 3.0] Triple persistence failed:', error);
            }
        }

        // 4. Detect implicit entity mentions in plain text
        if (this.config.enableImplicitMatching) {
            try {
                const implicitStart = performance.now();
                const fullText = changes.map(c => c.text).join(' ');

                let implicitMatches = implicitEntityMatcher.findImplicitMentions(
                    fullText,
                    noteId
                );

                // Apply limits
                if (implicitMatches.length > MAX_IMPLICIT_MATCHES) {
                    console.warn(`[Scanner 3.0] Too many implicit matches (${implicitMatches.length}), truncating`);
                    implicitMatches = implicitMatches.slice(0, MAX_IMPLICIT_MATCHES);
                }

                const filtered = implicitEntityMatcher.filterExplicitSyntax(fullText, implicitMatches);

                if (filtered.length > 0) {
                    console.log(
                        `[Scanner 3.0] Found ${filtered.length} implicit entity mentions:`,
                        filtered.slice(0, 5).map(m => m.matchedText), // Only log first 5
                        filtered.length > 5 ? `... and ${filtered.length - 5} more` : ''
                    );

                    // Update mention counts in registry
                    for (const match of filtered) {
                        try {
                            await entityRegistry.updateNoteMentions(
                                match.entity.id,
                                noteId,
                                1 // Increment by 1
                            );
                        } catch (mentionError) {
                            // Non-critical - continue processing
                        }
                    }
                }

                this.logPerformance('Implicit matching', implicitStart);
            } catch (error) {
                console.error('[Scanner 3.0] Implicit matching phase failed:', error);
            }
        }

        // 5. Relationship Inference (SVO, PREP, POSSESSION patterns)
        if (this.config.enableRelationshipInference) {
            try {
                const relStart = performance.now();
                const relExtractor = getRelationshipExtractor();
                const fullText = changes.map(c => c.context || c.text).join(' ');

                // Build entity spans from registered entities in the text
                const allEntities = entityRegistry.getAllEntities();
                const entitySpans: EntitySpan[] = [];

                for (const entity of allEntities) {
                    const searchTerms = [entity.label, ...(entity.aliases || [])];
                    for (const term of searchTerms) {
                        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
                        let match;
                        while ((match = regex.exec(fullText)) !== null) {
                            entitySpans.push({
                                label: entity.label,
                                start: match.index,
                                end: match.index + match[0].length,
                                kind: entity.kind,
                            });
                        }
                    }
                }

                if (entitySpans.length >= 2) {
                    // Extract relationships using linguistic patterns
                    const relationships = relExtractor.extractFromText(fullText, noteId);

                    // Filter by confidence and deduplicate
                    const deduplicated = relExtractor.deduplicateRelationships(relationships);
                    const filtered = deduplicated.filter(
                        r => r.confidence >= this.config.relationshipConfidenceThreshold
                    );

                    if (filtered.length > 0) {
                        console.log(
                            `[Scanner 3.0] Inferred ${filtered.length} relationships:`,
                            filtered.slice(0, 3).map(r =>
                                `${r.source.text} -[${r.predicate}]-> ${r.target.text}`
                            ),
                            filtered.length > 3 ? `... and ${filtered.length - 3} more` : ''
                        );

                        // Persist relationships
                        const result = await relExtractor.persistRelationships(filtered);
                        console.log(
                            `[Scanner 3.0] Relationships: ${result.added} added, ${result.failed} failed`
                        );
                    }
                }

                this.logPerformance('Relationship inference', relStart);
            } catch (error) {
                console.error('[Scanner 3.0] Relationship inference failed:', error);
            }
        }

        // Clear processed changes
        this.changeDetector.clearChanges(noteId);

        const totalDuration = performance.now() - overallStart;
        console.log(`[Scanner 3.0] Completed processing for ${noteId} in ${totalDuration.toFixed(1)}ms`);
    }

    /**
     * Hook for persistence (dependency injection)
     */
    private persistTriplesHook: ((triples: ExtractedTriple[], noteId: string) => Promise<void>) | null = null;

    public setTriplePersistence(fn: (triples: ExtractedTriple[], noteId: string) => Promise<void>) {
        this.persistTriplesHook = fn;
    }

    /**
     * Shutdown scanner
     */
    shutdown(): void {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        scannerEventBus.clear();
        this.isInitialized = false;
        console.log('[Scanner 3.0] Shutdown');
    }
}

// Singleton instance
export const scannerOrchestrator = new ScannerOrchestrator();

