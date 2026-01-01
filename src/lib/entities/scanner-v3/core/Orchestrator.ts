import { scannerEventBus } from './ScannerEventBus';
import { ChangeDetector, type DocumentChange } from './ChangeDetector';
import { patternExtractor } from '../extractors/PatternExtractor';
import { ahoCorasickExtractor } from '../extractors/AhoCorasickExtractor';
import { tripleExtractor, type ExtractedTriple } from '../extractors/TripleExtractor';
import { implicitEntityMatcher } from '../extractors/ImplicitEntityMatcher';
import { allProfanityEntityMatcher } from '../extractors/AllProfanityEntityMatcher';
import { getRelationshipExtractor, type EntitySpan } from '../extractors/RelationshipExtractor';
import { temporalAhoMatcher, type TemporalMention } from '../extractors/TemporalAhoMatcher';
import { initializeTemporalPersistence } from '../persistence/TemporalMentionPersistence';
import { nlpEnricher } from '../enrichers/NLPEnricher';
import { entityDisambiguator } from '../enrichers/EntityDisambiguator';
import type { EnrichedMatch } from '../enrichers/types';
import { entityRegistry } from '@/lib/cozo/graph/adapters';
import type { PatternMatchEvent, ScannerConfig } from '../types';

import { triplePersistence } from '../persistence/TriplePersistence';
import { rustScanner, type ScanResult as RustScanResult } from '../bridge/RustScanner';

// Limits to prevent memory issues
const MAX_ENTITIES_PER_SCAN = 100;
const MAX_TRIPLES_PER_SCAN = 50;
const MAX_IMPLICIT_MATCHES = 200;
const SLOW_OPERATION_THRESHOLD_MS = 100;

/**
 * Main Scanner 3.5 coordinator
 * Listens to pattern-matched events and orchestrates extraction
 */
export class ScannerOrchestrator {
    private config: ScannerConfig;
    private changeDetector: ChangeDetector;
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private isInitialized = false;
    private relationshipWorker: Worker | null = null;

    constructor(config: Partial<ScannerConfig> = {}) {
        this.config = {
            debounceMs: 500,
            enableNLP: true, // Phase 7: enabled
            enableNeuroBERT: false,
            enableTriples: true,
            enableImplicitMatching: true,
            enableRelationshipInference: true, // Phase 7C: enabled
            enableTemporalExtraction: true, // Temporal Aho-Corasick extraction
            relationshipConfidenceThreshold: 0.65,
            batchSize: 50,
            useAhoCorasickExtractor: true, // O(n) Aho-Corasick enabled by default
            useAllProfanityMatcher: true, // Scanner 3.5: AllProfanity for implicit matching
            useRelationshipWorker: true, // Scanner 3.5: Web Worker for relationship extraction
            useRustScanner: false, // Scanner 4.0: Rust/WASM (disabled by default)
            ...config,
        };
        this.changeDetector = new ChangeDetector();

        // Wire up persistence
        this.setTriplePersistence((triples, noteId) =>
            triplePersistence.persistTriples(triples, noteId)
        );
    }

    /**
     * Get or create the relationship extraction Web Worker
     */
    private getRelationshipWorker(): Worker {
        if (!this.relationshipWorker) {
            this.relationshipWorker = new Worker(
                new URL('../workers/RelationshipWorker.ts', import.meta.url),
                { type: 'module' }
            );
        }
        return this.relationshipWorker;
    }

    /**
     * Get the active pattern extractor based on config
     */
    private get extractor() {
        return this.config.useAhoCorasickExtractor
            ? ahoCorasickExtractor
            : patternExtractor;
    }

    /**
     * Initialize scanner (subscribe to events)
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        scannerEventBus.on('pattern-matched', this.handlePatternMatch.bind(this));

        // Scanner 4.0: Initialize Rust Scanner
        if (this.config.useRustScanner) {
            try {
                await rustScanner.initialize();
                console.log('[Scanner 4.0] Rust Scanner initialized');
            } catch (error) {
                console.error('[Scanner 4.0] Failed to initialize Rust Scanner, falling back to TS', error);
                this.config.useRustScanner = false;
            }
        }

        // Scanner 3.5: Initialize AllProfanity matcher with registered entities
        if (this.config.useAllProfanityMatcher && !this.config.useRustScanner) {
            try {
                const entities = entityRegistry.getAllEntities();
                allProfanityEntityMatcher.initialize(entities, this.config.allProfanityConfig);
                console.log('[Scanner 3.5] AllProfanity matcher initialized with', entities.length, 'entities');
            } catch (error) {
                console.warn('[Scanner 3.5] Failed to initialize AllProfanity matcher:', error);
                // Fallback: disable AllProfanity path in ImplicitEntityMatcher
                implicitEntityMatcher.setUseAllProfanity(false);
            }
        } else {
            // Explicitly disable if not configured
            implicitEntityMatcher.setUseAllProfanity(false);
        }

        // Load relationship patterns from CoZo/Blueprint Hub
        if (this.config.enableRelationshipInference) {
            try {
                const relExtractor = getRelationshipExtractor();
                await relExtractor.loadPatternsFromCoZo();
                console.log('[Scanner 3.5] Relationship patterns loaded from CoZo');
            } catch (error) {
                console.warn('[Scanner 3.5] Failed to load CoZo patterns:', error);
            }
        }

        // Initialize temporal mention persistence
        if (this.config.enableTemporalExtraction) {
            initializeTemporalPersistence();
        }

        this.isInitialized = true;
        console.log('[Scanner 3.5] Initialized');
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
            console.log('[Scanner 3.5] Relationship patterns reloaded');
        } catch (error) {
            console.error('[Scanner 3.5] Failed to reload patterns:', error);
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
            console.warn(`[Scanner 3.5] Slow operation: ${operation} took ${duration.toFixed(1)}ms`);
        }
    }

    /**
     * Process all pending changes for a note
     */
    private async processPendingChanges(noteId: string): Promise<void> {
        const overallStart = performance.now();
        const changes = this.changeDetector.getPendingChanges(noteId);
        if (changes.length === 0) return;

        // Scanner 4.0: Delegates processing to Rust/WASM scanner
        if (this.config.useRustScanner) {
            await this.processWithRust(noteId, changes);
            this.changeDetector.clearChanges(noteId);
            return;
        }

        console.log(`[Scanner 3.5] Processing ${changes.length} changes for ${noteId}`);

        // OPTIMIZATION: Single entity fetch for entire scan cycle
        // This prevents O(n) lookups in every downstream extractor
        const cachedEntities = entityRegistry.getAllEntities();


        // 1. Extract and register entities
        try {
            const entityStart = performance.now();
            let entityEvents = changes.filter(c => c.text.match(/^\[([A-Z_]+)/));

            // Apply limit to prevent memory issues
            if (entityEvents.length > MAX_ENTITIES_PER_SCAN) {
                console.warn(`[Scanner 3.5] Too many entities (${entityEvents.length}), truncating to ${MAX_ENTITIES_PER_SCAN}`);
                entityEvents = entityEvents.slice(0, MAX_ENTITIES_PER_SCAN);
            }

            for (const change of entityEvents) {
                try {
                    let events = this.extractor.extractEntities(change.text, noteId);

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
                    console.error('[Scanner 3.5] Error extracting entity from:', change.text, entityError);
                }
            }

            this.logPerformance('Entity extraction', entityStart);
        } catch (error) {
            console.error('[Scanner 3.5] Entity extraction phase failed:', error);
        }

        // 2. Extract triples if enabled
        let extractedTriples: ExtractedTriple[] = [];
        if (this.config.enableTriples) {
            try {
                const tripleStart = performance.now();
                let tripleChanges = changes.filter(c => c.text.includes('->'));

                for (const change of tripleChanges) {
                    try {
                        const events = this.extractor.extractTriples(change.text, noteId);
                        for (const event of events) {
                            const triple = tripleExtractor.parseTriple(event, change.text);
                            if (triple && tripleExtractor.validateTriple(triple)) {
                                extractedTriples.push(triple);
                            }
                        }
                    } catch (tripleError) {
                        console.error('[Scanner 3.5] Error extracting triple from:', change.text, tripleError);
                    }
                }

                // Apply limit
                if (extractedTriples.length > MAX_TRIPLES_PER_SCAN) {
                    console.warn(`[Scanner 3.5] Too many triples (${extractedTriples.length}), truncating to ${MAX_TRIPLES_PER_SCAN}`);
                    extractedTriples = extractedTriples.slice(0, MAX_TRIPLES_PER_SCAN);
                }

                this.logPerformance('Triple extraction', tripleStart);
            } catch (error) {
                console.error('[Scanner 3.5] Triple extraction phase failed:', error);
            }
        }

        // 3. Persist Triples
        if (this.persistTriplesHook && extractedTriples.length > 0) {
            try {
                const persistStart = performance.now();
                await this.persistTriplesHook(extractedTriples, noteId);
                this.logPerformance('Triple persistence', persistStart);
            } catch (error) {
                console.error('[Scanner 3.5] Triple persistence failed:', error);
            }
        }

        // 4. Detect implicit entity mentions in plain text
        if (this.config.enableImplicitMatching) {
            try {
                const implicitStart = performance.now();
                const fullText = changes.map(c => c.text).join(' ');

                let implicitMatches = implicitEntityMatcher.findImplicitMentions(
                    fullText,
                    noteId,
                    cachedEntities // Pass cached entities
                );

                // Apply limits
                if (implicitMatches.length > MAX_IMPLICIT_MATCHES) {
                    console.warn(`[Scanner 3.5] Too many implicit matches (${implicitMatches.length}), truncating`);
                    implicitMatches = implicitMatches.slice(0, MAX_IMPLICIT_MATCHES);
                }

                const filtered = implicitEntityMatcher.filterExplicitSyntax(fullText, implicitMatches);

                if (filtered.length > 0) {
                    console.log(
                        `[Scanner 3.5] Found ${filtered.length} implicit entity mentions:`,
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
                console.error('[Scanner 3.5] Implicit matching phase failed:', error);
            }
        }

        // 5. Relationship Inference (SVO, PREP, POSSESSION patterns)
        if (this.config.enableRelationshipInference) {
            try {
                const relStart = performance.now();
                const relExtractor = getRelationshipExtractor();
                const uniqueContexts = new Set<string>();
                const fragments: string[] = [];

                for (const change of changes) {
                    const text = change.context || change.text;
                    if (text && !uniqueContexts.has(text)) {
                        uniqueContexts.add(text);
                        fragments.push(text);
                    }
                }

                const fullText = fragments.join(' ');

                // Build entity spans using AllProfanity's O(n) matching
                let entitySpans: EntitySpan[] = [];

                if (allProfanityEntityMatcher.isInitialized()) {
                    const matches = allProfanityEntityMatcher.findMentions(fullText);
                    entitySpans = matches.map(m => ({
                        label: m.entity.label,
                        start: m.position,
                        end: m.position + m.length,
                        kind: m.entity.kind,
                    }));
                } else {
                    const lowerFullText = fullText.toLowerCase();
                    for (const entity of cachedEntities) {
                        const searchTerms = [entity.label, ...(entity.aliases || [])];
                        for (const term of searchTerms) {
                            const lowerTerm = term.toLowerCase();
                            let idx = 0;
                            while ((idx = lowerFullText.indexOf(lowerTerm, idx)) !== -1) {
                                entitySpans.push({
                                    label: entity.label,
                                    start: idx,
                                    end: idx + term.length,
                                    kind: entity.kind,
                                });
                                idx += term.length;
                            }
                        }
                    }
                }

                if (entitySpans.length >= 2) {
                    // Check if Web Worker is enabled
                    if (this.config.useRelationshipWorker) {
                        // Web Worker path: Non-blocking extraction
                        const worker = this.getRelationshipWorker();

                        // Serialize entities for worker
                        const serializedEntities = cachedEntities.map(e => ({
                            id: e.id,
                            label: e.label,
                            aliases: e.aliases || [],
                            kind: e.kind,
                        }));

                        // Get pattern rules for worker
                        const verbRules = relExtractor.getVerbPatternRules();
                        const prepRules = relExtractor.getPrepPatternRules();

                        // Send to worker
                        worker.postMessage({
                            type: 'EXTRACT_RELATIONSHIPS',
                            payload: {
                                text: fullText,
                                noteId,
                                entities: serializedEntities,
                                verbRules,
                                prepRules,
                            }
                        });

                        // Handle worker response
                        worker.onmessage = async (event) => {
                            if (event.data.type === 'RELATIONSHIPS_EXTRACTED') {
                                const { relationships, stats } = event.data.payload;

                                // Filter by confidence threshold
                                const filtered = relationships.filter(
                                    (r: any) => r.confidence >= this.config.relationshipConfidenceThreshold
                                );

                                if (filtered.length > 0) {
                                    console.log(
                                        `[Scanner 3.5] Worker extracted ${filtered.length} relationships in ${stats.processingTimeMs.toFixed(1)}ms:`,
                                        `SVO=${stats.svoCount}, PREP=${stats.prepCount}, POSS=${stats.possessionCount}`
                                    );

                                    // Convert worker output to ExtractedRelationship format and persist
                                    const forPersistence = filtered.map((r: any) => ({
                                        source: {
                                            entity: cachedEntities.find(e => e.id === r.sourceEntityId)!,
                                            text: r.sourceText,
                                            position: r.sourcePosition,
                                        },
                                        target: {
                                            entity: cachedEntities.find(e => e.id === r.targetEntityId)!,
                                            text: r.targetText,
                                            position: r.targetPosition,
                                        },
                                        predicate: r.predicate,
                                        pattern: r.pattern,
                                        confidence: r.confidence,
                                        context: {
                                            sentence: r.sentenceText,
                                            sentenceIndex: r.sentenceIndex,
                                            verbLemma: r.verbLemma,
                                            preposition: r.preposition,
                                        },
                                        metadata: {
                                            extractedAt: new Date(r.extractedAt),
                                            noteId: r.noteId,
                                        },
                                    }));

                                    const deduplicated = relExtractor.deduplicateRelationships(forPersistence);
                                    const result = await relExtractor.persistRelationships(deduplicated);
                                    console.log(
                                        `[Scanner 3.5] Relationships: ${result.added} added, ${result.failed} failed`
                                    );
                                }
                            } else if (event.data.type === 'RELATIONSHIP_ERROR') {
                                console.error('[Scanner 3.5] Worker error:', event.data.payload.error);
                            }
                        };
                    } else {
                        // Fallback: Sync extraction (blocks main thread)
                        const relationships = relExtractor.extractFromText(fullText, noteId, cachedEntities);
                        const deduplicated = relExtractor.deduplicateRelationships(relationships);
                        const filtered = deduplicated.filter(
                            r => r.confidence >= this.config.relationshipConfidenceThreshold
                        );

                        if (filtered.length > 0) {
                            console.log(
                                `[Scanner 3.5] Inferred ${filtered.length} relationships:`,
                                filtered.slice(0, 3).map(r =>
                                    `${r.source.text} -[${r.predicate}]-> ${r.target.text}`
                                ),
                                filtered.length > 3 ? `... and ${filtered.length - 3} more` : ''
                            );

                            const result = await relExtractor.persistRelationships(filtered);
                            console.log(
                                `[Scanner 3.5] Relationships: ${result.added} added, ${result.failed} failed`
                            );
                        }
                    }
                }

                this.logPerformance('Relationship inference', relStart);
            } catch (error) {
                console.error('[Scanner 3.5] Relationship inference failed:', error);
            }
        }

        // 5. Temporal extraction (pure Aho-Corasick, no NLP)
        if (this.config.enableTemporalExtraction) {
            try {
                const temporalStart = performance.now();

                // Gather all text for temporal scanning
                const fullText = changes.map(c => c.text).join(' ');

                if (fullText.length > 0) {
                    const temporalResult = temporalAhoMatcher.scan(fullText);

                    if (temporalResult.mentions.length > 0) {
                        console.log(
                            `[Scanner 3.5] Detected ${temporalResult.mentions.length} temporal mentions in ${temporalResult.stats.scanTimeMs.toFixed(1)}ms:`,
                            temporalResult.mentions.slice(0, 5).map(m => `${m.kind}:${m.text}`),
                            temporalResult.mentions.length > 5 ? `... and ${temporalResult.mentions.length - 5} more` : ''
                        );

                        // Emit temporal mentions for downstream consumers (timeline-extractor, graph builder)
                        scannerEventBus.emit('temporal:detected', {
                            noteId,
                            mentions: temporalResult.mentions,
                            timestamp: Date.now(),
                            fullText  // Include fullText for context extraction
                        });
                    }
                }

                this.logPerformance('Temporal extraction', temporalStart);
            } catch (error) {
                console.error('[Scanner 3.5] Temporal extraction failed:', error);
            }
        }

        // Clear processed changes
        this.changeDetector.clearChanges(noteId);

        const totalDuration = performance.now() - overallStart;
        console.log(`[Scanner 3.5] Completed processing for ${noteId} in ${totalDuration.toFixed(1)}ms`);
    }

    /**
     * Hook for persistence (dependency injection)
     */
    private persistTriplesHook: ((triples: ExtractedTriple[], noteId: string) => Promise<void>) | null = null;

    public setTriplePersistence(fn: (triples: ExtractedTriple[], noteId: string) => Promise<void>) {
        this.persistTriplesHook = fn;
    }

    /**
     * Scanner 4.0: Delegates processing to Rust/WASM scanner
     */
    private async processWithRust(noteId: string, changes: DocumentChange[]): Promise<void> {
        const fullText = changes.map(c => c.text).join('\n\n');

        // 1. Hydrate entities
        const entities = entityRegistry.getAllEntities();
        // Convert to Rust EntityDefinition types (simple mapping since shapes align)
        const rustEntities = entities.map(e => ({
            id: e.id,
            label: e.label,
            kind: e.kind,
            aliases: e.aliases || []
        }));

        await rustScanner.hydrateEntities(rustEntities);

        // 2. Scan (immediate execution since we are already debounced)
        // We pass empty spans because "strict Rust logic" requires self-sufficiency
        const result = rustScanner.scanImmediate(noteId, fullText, []);

        if (!result) return;

        // 3. Persist Triples
        if (this.config.enableTriples && result.triples.length > 0) {
            // Map Rust triples to TS ExtractedTriple format
            const mappedTriples = result.triples.map(t => {
                const subjectEntity = entities.find(e => e.label === t.source);
                const objectEntity = entities.find(e => e.label === t.target);

                return {
                    subject: {
                        kind: subjectEntity?.kind || 'CONCEPT',
                        label: t.source,
                        id: subjectEntity?.id
                    },
                    predicate: t.predicate,
                    object: {
                        kind: objectEntity?.kind || 'CONCEPT',
                        label: t.target,
                        id: objectEntity?.id
                    },
                    context: t.raw_text,
                    confidence: 0.95,
                    position: t.start
                };
            });

            await triplePersistence.persistTriples(mappedTriples, noteId);
            console.log(`[Scanner 4.0] Persisted ${result.triples.length} triples`);
        }

        // 4. Persist Relations
        if (this.config.enableRelationshipInference && result.relations.length > 0) {
            const relExtractor = getRelationshipExtractor();

            // Map Rust relations to persistence format
            const forPersistence = result.relations.map(r => {
                const headEntity = entities.find(e => e.label === r.head_entity);
                const tailEntity = entities.find(e => e.label === r.tail_entity);
                if (!headEntity || !tailEntity) return null;

                return {
                    source: {
                        entity: headEntity,
                        text: r.head_entity,
                        position: r.head_start
                    },
                    target: {
                        entity: tailEntity,
                        text: r.tail_entity,
                        position: r.tail_start
                    },
                    predicate: r.relation_type,
                    pattern: r.pattern_matched,
                    confidence: r.confidence,
                    context: {
                        sentence: fullText.substring(Math.max(0, r.pattern_start - 20), Math.min(fullText.length, r.pattern_end + 20)),
                        sentenceIndex: 0,
                        verbLemma: r.relation_type,
                        preposition: ''
                    },
                    metadata: {
                        extractedAt: new Date(),
                        noteId: noteId
                    }
                };
            }).filter(r => r !== null);

            const deduplicated = relExtractor.deduplicateRelationships(forPersistence as any[]);
            const persistResult = await relExtractor.persistRelationships(deduplicated);
            console.log(`[Scanner 4.0] Relationships: ${persistResult.added} added, ${persistResult.failed} failed`);
        }

        console.log(`[Scanner 4.0] Completed processing for ${noteId}`);
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

        // Terminate relationship worker
        if (this.relationshipWorker) {
            this.relationshipWorker.terminate();
            this.relationshipWorker = null;
        }

        this.isInitialized = false;
        console.log('[Scanner 3.5] Shutdown');
    }
}

// Singleton instance
export const scannerOrchestrator = new ScannerOrchestrator();

