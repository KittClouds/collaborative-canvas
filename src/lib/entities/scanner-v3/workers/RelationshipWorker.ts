/**
 * RelationshipWorker - Web Worker for parallel relationship extraction
 * 
 * Moves the expensive Wink NLP analysis off the main thread.
 * Replicates full extraction logic including SVO, PREP, and POSSESSION patterns.
 * 
 * CRITICAL: This worker rebuilds verbLookup and prepLookup Maps from
 * serialized pattern rules to ensure all relationship types are extracted.
 */

import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

// ==================== TYPE DEFINITIONS ====================

interface VerbPatternRule {
    id: string;
    relationshipType: string;
    inverseType?: string;
    verbs: string[];
    confidence: number;
    category: string;
    bidirectional: boolean;
    sourceKinds?: string[];
    targetKinds?: string[];
}

interface PrepPatternRule {
    relationshipType: string;
    preps: string[];
    targetKinds?: string[];
    confidence: number;
}

interface SerializedEntity {
    id: string;
    label: string;
    aliases: string[];
    kind: string;
}

interface Token {
    text: string;
    lemma: string;
    pos: string;
    start: number;
    end: number;
    sentenceIndex: number;
}

interface Sentence {
    index: number;
    text: string;
    tokens: Token[];
    start: number;
    end: number;
}

interface EntityMention {
    entity: SerializedEntity;
    text: string;
    position: number;
    tokenIndex: number;
}

interface SerializedRelationship {
    sourceEntityId: string;
    sourceText: string;
    sourcePosition: number;
    targetEntityId: string;
    targetText: string;
    targetPosition: number;
    predicate: string;
    pattern: 'SVO' | 'PREP' | 'POSSESSION';
    confidence: number;
    sentenceText: string;
    sentenceIndex: number;
    verbLemma?: string;
    preposition?: string;
    noteId: string;
    extractedAt: number;
}

interface WorkerRequest {
    type: 'EXTRACT_RELATIONSHIPS';
    payload: {
        text: string;
        noteId: string;
        entities: SerializedEntity[];
        verbRules: VerbPatternRule[];
        prepRules: PrepPatternRule[];
    };
}

interface WorkerResponse {
    type: 'RELATIONSHIPS_EXTRACTED';
    payload: {
        relationships: SerializedRelationship[];
        stats: {
            processingTimeMs: number;
            sentenceCount: number;
            mentionCount: number;
            svoCount: number;
            prepCount: number;
            possessionCount: number;
        };
    };
}

// ==================== WORKER STATE ====================

let nlp: any = null;
let its: any = null;
const verbLookup = new Map<string, VerbPatternRule[]>();
const prepLookup = new Map<string, PrepPatternRule[]>();

const VERB_POS_TAGS = ['VERB', 'AUX'];
const PREPOSITION_POS = 'ADP';

// ==================== INITIALIZATION ====================

function ensureNlpInitialized(): void {
    if (!nlp) {
        nlp = winkNLP(model, ['sbd', 'pos']);
        its = nlp.its;
        console.log('[RelationshipWorker] Wink NLP initialized');
    }
}

function buildLookupMaps(verbRules: VerbPatternRule[], prepRules: PrepPatternRule[]): void {
    verbLookup.clear();
    for (const rule of verbRules) {
        for (const verb of rule.verbs) {
            if (!verbLookup.has(verb)) {
                verbLookup.set(verb, []);
            }
            verbLookup.get(verb)!.push(rule);
        }
    }

    prepLookup.clear();
    for (const rule of prepRules) {
        for (const prep of rule.preps) {
            if (!prepLookup.has(prep)) {
                prepLookup.set(prep, []);
            }
            prepLookup.get(prep)!.push(rule);
        }
    }
}

// ==================== NLP ANALYSIS ====================

function analyzeText(text: string): { sentences: Sentence[]; tokens: Token[] } {
    ensureNlpInitialized();

    const doc = nlp.readDoc(text);
    const allTokens: Token[] = [];

    const tokenValues = doc.tokens().out();
    const tokenLemmas = doc.tokens().out(its.lemma);
    const tokenPOSTags = doc.tokens().out(its.pos);

    let cursor = 0;
    for (let i = 0; i < tokenValues.length; i++) {
        const val = tokenValues[i];
        const start = text.indexOf(val, cursor);
        const safeStart = start !== -1 ? start : cursor;
        const end = safeStart + val.length;

        allTokens.push({
            text: val,
            lemma: tokenLemmas[i] || val.toLowerCase(),
            pos: tokenPOSTags[i] || 'X',
            start: safeStart,
            end: end,
            sentenceIndex: -1,
        });

        cursor = end;
    }

    const sentences: Sentence[] = [];
    const sentenceSpans = doc.sentences().out(its.span);
    const sentenceTexts = doc.sentences().out();

    for (let sIdx = 0; sIdx < sentenceTexts.length; sIdx++) {
        const span = sentenceSpans[sIdx];
        if (!span) continue;

        const [startIdx, endIdx] = span;
        const sentTokens = allTokens.slice(startIdx, endIdx + 1);

        sentTokens.forEach(t => t.sentenceIndex = sIdx);

        const sentStart = sentTokens[0]?.start ?? 0;
        const sentEnd = sentTokens[sentTokens.length - 1]?.end ?? 0;

        sentences.push({
            index: sIdx,
            text: sentenceTexts[sIdx],
            tokens: sentTokens,
            start: sentStart,
            end: sentEnd
        });
    }

    return { sentences, tokens: allTokens };
}

// ==================== ENTITY MENTION DETECTION ====================

function findEntityMentionsInSentence(
    sentence: Sentence,
    entities: SerializedEntity[]
): EntityMention[] {
    const mentions: EntityMention[] = [];
    const lowerSentence = sentence.text.toLowerCase();

    for (const entity of entities) {
        const searchTerms = [entity.label, ...(entity.aliases || [])];

        for (const term of searchTerms) {
            const lowerTerm = term.toLowerCase();
            if (lowerSentence.indexOf(lowerTerm) === -1) continue;

            let searchStart = 0;
            let idx: number;

            while ((idx = lowerSentence.indexOf(lowerTerm, searchStart)) !== -1) {
                const absolutePosition = sentence.start + idx;
                const tokenIndex = sentence.tokens.findIndex(
                    t => t.start <= absolutePosition && t.end > absolutePosition
                );

                mentions.push({
                    entity,
                    text: term,
                    position: absolutePosition,
                    tokenIndex: tokenIndex !== -1 ? tokenIndex : 0,
                });

                searchStart = idx + term.length;
            }
        }
    }

    return deduplicateMentions(mentions);
}

function deduplicateMentions(mentions: EntityMention[]): EntityMention[] {
    mentions.sort((a, b) => a.position - b.position);
    const result: EntityMention[] = [];
    let lastEnd = -1;

    for (const mention of mentions) {
        if (mention.position >= lastEnd) {
            result.push(mention);
            lastEnd = mention.position + mention.text.length;
        }
    }

    return result;
}

// ==================== RELATIONSHIP EXTRACTION ====================

function extractSVO(
    sentence: Sentence,
    mentions: EntityMention[],
    noteId: string
): SerializedRelationship[] {
    const relationships: SerializedRelationship[] = [];
    const MAX_TOKEN_DISTANCE = 10;

    for (let i = 0; i < mentions.length - 1; i++) {
        const source = mentions[i];

        for (let j = i + 1; j < mentions.length; j++) {
            const target = mentions[j];
            const tokenDistance = target.tokenIndex - source.tokenIndex;

            if (tokenDistance > MAX_TOKEN_DISTANCE) break;

            const tokensBetween = sentence.tokens.slice(
                source.tokenIndex + 1,
                target.tokenIndex
            );

            const verbsBetween = tokensBetween.filter(t => VERB_POS_TAGS.includes(t.pos));
            if (verbsBetween.length === 0) continue;

            const verb = verbsBetween[0];
            const verbLemma = verb.lemma.toLowerCase();

            // Check verb lookup
            const rules = verbLookup.get(verbLemma);
            if (rules && rules.length > 0) {
                const rule = rules[0];

                relationships.push({
                    sourceEntityId: source.entity.id,
                    sourceText: source.text,
                    sourcePosition: source.position,
                    targetEntityId: target.entity.id,
                    targetText: target.text,
                    targetPosition: target.position,
                    predicate: rule.relationshipType,
                    pattern: 'SVO',
                    confidence: rule.confidence,
                    sentenceText: sentence.text,
                    sentenceIndex: sentence.index,
                    verbLemma,
                    noteId,
                    extractedAt: Date.now(),
                });
            } else {
                // Fallback: use raw verb as predicate
                relationships.push({
                    sourceEntityId: source.entity.id,
                    sourceText: source.text,
                    sourcePosition: source.position,
                    targetEntityId: target.entity.id,
                    targetText: target.text,
                    targetPosition: target.position,
                    predicate: verbLemma.toUpperCase(),
                    pattern: 'SVO',
                    confidence: 0.6,
                    sentenceText: sentence.text,
                    sentenceIndex: sentence.index,
                    verbLemma,
                    noteId,
                    extractedAt: Date.now(),
                });
            }
        }
    }

    return relationships;
}

function extractPrep(
    sentence: Sentence,
    mentions: EntityMention[],
    noteId: string
): SerializedRelationship[] {
    const relationships: SerializedRelationship[] = [];

    for (let i = 0; i < mentions.length - 1; i++) {
        const source = mentions[i];

        for (let j = i + 1; j < mentions.length; j++) {
            const target = mentions[j];

            const tokensBetween = sentence.tokens.slice(
                source.tokenIndex + 1,
                target.tokenIndex
            );

            const preps = tokensBetween.filter(t => t.pos === PREPOSITION_POS);
            if (preps.length === 0) continue;

            const prep = preps[0];
            const prepText = prep.text.toLowerCase();

            const rules = prepLookup.get(prepText);
            if (rules && rules.length > 0) {
                // Find best matching rule
                const rule = rules.find(r =>
                    !r.targetKinds || r.targetKinds.includes(target.entity.kind)
                ) || rules[0];

                relationships.push({
                    sourceEntityId: source.entity.id,
                    sourceText: source.text,
                    sourcePosition: source.position,
                    targetEntityId: target.entity.id,
                    targetText: target.text,
                    targetPosition: target.position,
                    predicate: rule.relationshipType,
                    pattern: 'PREP',
                    confidence: rule.confidence,
                    sentenceText: sentence.text,
                    sentenceIndex: sentence.index,
                    preposition: prepText,
                    noteId,
                    extractedAt: Date.now(),
                });
            }
        }
    }

    return relationships;
}

function extractPossession(
    sentence: Sentence,
    mentions: EntityMention[],
    noteId: string
): SerializedRelationship[] {
    const relationships: SerializedRelationship[] = [];

    for (let i = 0; i < mentions.length - 1; i++) {
        const source = mentions[i];
        const sourceEnd = source.position + source.text.length;

        const textAfter = sentence.text.substring(
            sourceEnd - sentence.start,
            sourceEnd - sentence.start + 3
        );

        if (!textAfter.startsWith("'s") && !textAfter.startsWith("'")) continue;

        for (let j = i + 1; j < mentions.length; j++) {
            const target = mentions[j];
            if (target.position - sourceEnd > 20) break;

            relationships.push({
                sourceEntityId: source.entity.id,
                sourceText: source.text,
                sourcePosition: source.position,
                targetEntityId: target.entity.id,
                targetText: target.text,
                targetPosition: target.position,
                predicate: 'POSSESSES',
                pattern: 'POSSESSION',
                confidence: 0.80,
                sentenceText: sentence.text,
                sentenceIndex: sentence.index,
                noteId,
                extractedAt: Date.now(),
            });

            break;
        }
    }

    return relationships;
}

// ==================== MESSAGE HANDLER ====================

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
    const { type, payload } = event.data;

    if (type !== 'EXTRACT_RELATIONSHIPS') {
        return;
    }

    const startTime = performance.now();

    try {
        // Rebuild lookup maps from passed rules
        buildLookupMaps(payload.verbRules, payload.prepRules);

        // Analyze text with Wink NLP
        const { sentences } = analyzeText(payload.text);

        const allRelationships: SerializedRelationship[] = [];
        let mentionCount = 0;
        let svoCount = 0;
        let prepCount = 0;
        let possessionCount = 0;

        // Process each sentence
        for (const sentence of sentences) {
            const mentions = findEntityMentionsInSentence(sentence, payload.entities);
            mentionCount += mentions.length;

            if (mentions.length < 2) continue;

            // Extract all relationship types
            const svoRels = extractSVO(sentence, mentions, payload.noteId);
            const prepRels = extractPrep(sentence, mentions, payload.noteId);
            const possRels = extractPossession(sentence, mentions, payload.noteId);

            svoCount += svoRels.length;
            prepCount += prepRels.length;
            possessionCount += possRels.length;

            allRelationships.push(...svoRels, ...prepRels, ...possRels);
        }

        const processingTime = performance.now() - startTime;

        const response: WorkerResponse = {
            type: 'RELATIONSHIPS_EXTRACTED',
            payload: {
                relationships: allRelationships,
                stats: {
                    processingTimeMs: Math.round(processingTime * 100) / 100,
                    sentenceCount: sentences.length,
                    mentionCount,
                    svoCount,
                    prepCount,
                    possessionCount,
                },
            },
        };

        self.postMessage(response);

    } catch (error) {
        console.error('[RelationshipWorker] Error:', error);
        self.postMessage({
            type: 'RELATIONSHIP_ERROR',
            payload: {
                error: error instanceof Error ? error.message : String(error),
            },
        });
    }
};

console.log('[RelationshipWorker] Initialized');
