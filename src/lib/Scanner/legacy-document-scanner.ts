import { entityRegistry } from '@/lib/cozo/graph/adapters';
import type { DocumentConnections, EntityReference, Triple, EntityKind } from '@/lib/types/entityTypes';
import { parseEntityFromTitle, parseEntityWithRelation } from '@/lib/utils/titleParser';
import { getWinkProcessor, type Sentence, type LinguisticAnalysis } from './nlp/WinkProcessor';
import { regexEntityParser } from '@/lib/utils/regex-entity-parser';
import { scannerFacade } from '@/lib/scanner/scanner-facade';

export interface EntityMention {
    entityId: string;
    label: string;
    start: number;
    end: number;
    sentenceIndex: number;
    confidence: 'high' | 'medium' | 'low';
}

export interface DisambiguatedEntity {
    entity: { label: string; kind: string };
    mention: EntityMention;
    posContext: { before: string[]; after: string[] };
}

export interface ScanWithLinguisticsResult {
    statistics: {
        sentenceCount: number;
        tokenCount: number;
        relationshipCount: number;
    };
    sentences: Array<{ text: string }>;
    disambiguatedEntities: DisambiguatedEntity[];
    extractedRelationships: Array<{ source: string; target: string; type: string }>;
}

export interface CoOccurrenceResult {
    entity1: string;
    entity2: string;
    frequency: number;
    sentenceIndices: number[];
}

export interface DisambiguationContext {
    posContext: { before: string[]; after: string[] };
    sentence: string;
    confidence: 'high' | 'medium' | 'low';
}

// Legacy scanner-v3 stubs (use ScannerFacade instead)
interface PatternMatchEvent {
    kind: string;
    fullMatch: string;
    captures: Record<string, string>;
}

const patternExtractor = {
    extractEntities: (_text: string, _noteId: string): PatternMatchEvent[] => {
        console.warn('[documentScanner] patternExtractor is deprecated. Use ScannerFacade.');
        return [];
    },
    extractTriples: (_text: string, _noteId: string): PatternMatchEvent[] => [],
    extractFromText: (_text: string, _noteId: string): PatternMatchEvent[] => [],
};

const tripleExtractor = {
    parseTriples: (_events: PatternMatchEvent[], _text: string) => [],
    parseTriple: (_event: PatternMatchEvent, _text: string) => null,
};

/**
 * Scan a document (TipTap JSON) for entities and register them
 */
export function scanDocument(noteId: string, content: any): void {
    const text = extractText(content);

    // 1. Extract entities using PatternExtractor (no hardcoded regex!)
    const entityEvents = patternExtractor.extractEntities(text, noteId);

    for (const event of entityEvents) {
        const { captures } = event;
        entityRegistry.registerEntity(
            captures.label || event.fullMatch,
            (captures.entityKind || 'CONCEPT') as EntityKind,
            noteId,
            { subtype: captures.subtype }
        );
    }

    // 2. Extract and register triples
    const tripleEvents = patternExtractor.extractTriples(text, noteId);
    const parsedTriples = tripleExtractor.parseTriples(tripleEvents, text);

    for (const triple of parsedTriples) {
        // Register subject entity
        entityRegistry.registerEntity(
            triple.subject.label,
            triple.subject.kind as EntityKind,
            noteId,
            {}
        );

        // Register object entity  
        entityRegistry.registerEntity(
            triple.object.label,
            triple.object.kind as EntityKind,
            noteId,
            {}
        );
    }
}

/**
 * Parse connections (tags, mentions, links) from a document
 */
/**
 * Parse connections (tags, mentions, links) from a document
 * Uses ScannerFacade (Rust) + RegexEntityParser (Utils)
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
    if (scannerFacade.isReady()) {
        const scanResult = scannerFacade.scanImmediate(noteId, text);
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
                    subject: { label: triple.source, kind: 'CONCEPT' }, // Rust scanner might not return kind for subject/object yet
                    predicate: triple.predicate,
                    object: { label: triple.target, kind: 'CONCEPT' }
                });
            }
        }
    }

    // 3. Regex for WikiLinks, Tags, Mentions (Legacy patterns)
    // TODO: Move these to Rust/WASM eventually
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
 * Check if text contains raw entity syntax
 */
export function hasRawEntitySyntax(text: string): boolean {
    return /\[[A-Z_]+(?:\||:)/.test(text);
}


// --- Helper Functions ---

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
export async function findEntityMentionsParallel(
    sentences: Sentence[],
    text: string
): Promise<EntityMention[]> {
    const mentions: EntityMention[] = [];
    const allEntities = entityRegistry.getAllEntities();

    if (allEntities.length === 0) {
        return mentions;
    }

    const lowerText = text.toLowerCase();

    for (const entity of allEntities) {
        const patterns = [entity.label.toLowerCase()];
        if (entity.aliases) {
            patterns.push(...entity.aliases.map(a => a.toLowerCase()));
        }

        for (const pattern of patterns) {
            let startIdx = 0;
            while ((startIdx = lowerText.indexOf(pattern, startIdx)) !== -1) {
                const endIdx = startIdx + pattern.length;

                const sentenceIndex = sentences.findIndex(
                    s => startIdx >= s.start && endIdx <= s.end
                );

                mentions.push({
                    entityId: entity.id,
                    label: entity.label,
                    start: startIdx,
                    end: endIdx,
                    sentenceIndex: sentenceIndex >= 0 ? sentenceIndex : 0,
                    confidence: 'medium'
                });

                startIdx = endIdx;
            }
        }
    }

    return mentions;
}

export function scanDocumentWithLinguistics(
    noteId: string,
    content: any
): ScanWithLinguisticsResult {
    const text = extractText(content);
    const wink = getWinkProcessor();
    const analysis = wink.analyze(text);

    const allEntities = entityRegistry.getAllEntities();
    const disambiguatedEntities: DisambiguatedEntity[] = [];
    const extractedRelationships: Array<{ source: string; target: string; type: string }> = [];

    for (const entity of allEntities) {
        const lowerLabel = entity.label.toLowerCase();
        const lowerText = text.toLowerCase();
        let idx = lowerText.indexOf(lowerLabel);

        while (idx !== -1) {
            const posContext = wink.getContextualPOS(text, idx, 3);
            const sentenceIndex = analysis.sentences.findIndex(
                s => idx >= s.start && idx + entity.label.length <= s.end
            );

            const sentence = sentenceIndex >= 0 ? analysis.sentences[sentenceIndex] : null;
            const hasFollowingProperNoun = posContext.after.some(
                p => p === 'PROPN' || p === 'NNP'
            );
            const confidence = hasFollowingProperNoun ? 'high' : 'medium';

            disambiguatedEntities.push({
                entity: { label: entity.label, kind: entity.kind },
                mention: {
                    entityId: entity.id,
                    label: entity.label,
                    start: idx,
                    end: idx + entity.label.length,
                    sentenceIndex: sentenceIndex >= 0 ? sentenceIndex : 0,
                    confidence
                },
                posContext
            });

            idx = lowerText.indexOf(lowerLabel, idx + 1);
        }
    }

    for (const sentence of analysis.sentences) {
        const entitiesInSentence = disambiguatedEntities.filter(
            de => de.mention.sentenceIndex === sentence.index
        );

        for (let i = 0; i < entitiesInSentence.length; i++) {
            for (let j = i + 1; j < entitiesInSentence.length; j++) {
                extractedRelationships.push({
                    source: entitiesInSentence[i].entity.label,
                    target: entitiesInSentence[j].entity.label,
                    type: 'CO_OCCURS_WITH'
                });
            }
        }
    }

    return {
        statistics: {
            sentenceCount: analysis.statistics.sentenceCount,
            tokenCount: analysis.statistics.tokenCount,
            relationshipCount: extractedRelationships.length
        },
        sentences: analysis.sentences.map(s => ({ text: s.text })),
        disambiguatedEntities,
        extractedRelationships
    };
}

export function detectCoOccurrencesEnhanced(
    noteId: string,
    content: any
): CoOccurrenceResult[] {
    const text = extractText(content);
    const wink = getWinkProcessor();
    const analysis = wink.analyze(text);

    const allEntities = entityRegistry.getAllEntities();
    const coOccurrenceMap = new Map<string, CoOccurrenceResult>();

    const entityMentions: Array<{ label: string; start: number; end: number; sentenceIndex: number }> = [];

    for (const entity of allEntities) {
        const lowerLabel = entity.label.toLowerCase();
        const lowerText = text.toLowerCase();
        let idx = lowerText.indexOf(lowerLabel);

        while (idx !== -1) {
            const sentenceIndex = analysis.sentences.findIndex(
                s => idx >= s.start && idx + entity.label.length <= s.end
            );

            entityMentions.push({
                label: entity.label,
                start: idx,
                end: idx + entity.label.length,
                sentenceIndex: sentenceIndex >= 0 ? sentenceIndex : 0
            });

            idx = lowerText.indexOf(lowerLabel, idx + 1);
        }
    }

    for (const sentence of analysis.sentences) {
        const mentionsInSentence = entityMentions.filter(
            m => m.sentenceIndex === sentence.index
        );

        for (let i = 0; i < mentionsInSentence.length; i++) {
            for (let j = i + 1; j < mentionsInSentence.length; j++) {
                const e1 = mentionsInSentence[i].label;
                const e2 = mentionsInSentence[j].label;

                if (e1 === e2) continue;

                const [first, second] = e1 < e2 ? [e1, e2] : [e2, e1];
                const key = `${first}::${second}`;

                const existing = coOccurrenceMap.get(key);
                if (existing) {
                    existing.frequency++;
                    if (!existing.sentenceIndices.includes(sentence.index)) {
                        existing.sentenceIndices.push(sentence.index);
                    }
                } else {
                    coOccurrenceMap.set(key, {
                        entity1: first,
                        entity2: second,
                        frequency: 1,
                        sentenceIndices: [sentence.index]
                    });
                }
            }
        }
    }

    return Array.from(coOccurrenceMap.values());
}

export function getEntityDisambiguationContext(
    text: string,
    entityLabel: string,
    offset: number
): DisambiguationContext {
    const wink = getWinkProcessor();
    const analysis = wink.analyze(text);
    const posContext = wink.getContextualPOS(text, offset, 3);

    const sentence = analysis.sentences.find(
        s => offset >= s.start && offset <= s.end
    );

    const hasProperNounContext =
        posContext.after.some(p => p === 'PROPN' || p === 'NNP') ||
        posContext.before.some(p => p === 'PROPN' || p === 'NNP');

    const hasDeterminer = posContext.before.some(p => p === 'DET' || p === 'DT');

    let confidence: 'high' | 'medium' | 'low';
    if (hasProperNounContext) {
        confidence = 'high';
    } else if (hasDeterminer) {
        confidence = 'low';
    } else {
        confidence = 'medium';
    }

    return {
        posContext,
        sentence: sentence?.text || '',
        confidence
    };
}
