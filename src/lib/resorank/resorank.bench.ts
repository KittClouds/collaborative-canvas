/**
 * ResoRank Benchmark Tests
 * Run with: npx vitest bench src/lib/resorank/resorank.bench.ts
 */

import { bench, describe } from 'vitest';
import {
    ResoRankScorer,
    ResoRankIncrementalScorer,
    ProximityStrategy,
    CorpusStatistics,
    DocumentMetadata,
    TokenMetadata,
    calculateIdf,
    popCount,
    detectPhraseMatch,
    createBMXScorer,
} from './index';

// =============================================================================
// Test Data Generators
// =============================================================================

const WORDS = [
    'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog',
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing',
    'search', 'engine', 'ranking', 'algorithm', 'query', 'document', 'score',
    'proximity', 'term', 'frequency', 'inverse', 'field', 'weight', 'boost',
];

function randomWord(): string {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function generateDocument(wordCount: number): string[] {
    return Array.from({ length: wordCount }, () => randomWord());
}

function createCorpusStats(docCount: number): CorpusStatistics {
    return {
        totalDocuments: docCount,
        averageFieldLengths: new Map([
            [0, 10],  // Title
            [1, 150], // Body
        ]),
        averageDocumentLength: 160,
    };
}

function createDocumentMetadata(titleLen: number, bodyLen: number): DocumentMetadata {
    return {
        fieldLengths: new Map([
            [0, titleLen],
            [1, bodyLen],
        ]),
        totalTokenCount: titleLen + bodyLen,
    };
}

function createTokenMetadata(
    titleTf: number,
    bodyTf: number,
    titleLen: number,
    bodyLen: number,
    segmentMask: number,
    docFreq: number
): TokenMetadata {
    const fieldOccurrences = new Map<number, { tf: number; fieldLength: number }>();
    if (titleTf > 0) {
        fieldOccurrences.set(0, { tf: titleTf, fieldLength: titleLen });
    }
    if (bodyTf > 0) {
        fieldOccurrences.set(1, { tf: bodyTf, fieldLength: bodyLen });
    }
    return {
        fieldOccurrences,
        segmentMask,
        corpusDocFrequency: docFreq,
    };
}

// =============================================================================
// Corpus Setup
// =============================================================================

function setupSmallCorpus() {
    const corpusStats = createCorpusStats(100);
    const scorer = new ResoRankScorer({}, corpusStats);

    // Index 100 documents
    for (let i = 0; i < 100; i++) {
        const docMeta = createDocumentMetadata(8, 150);
        const tokens = new Map<string, TokenMetadata>();

        // Each doc has 5-10 unique terms
        const termCount = 5 + Math.floor(Math.random() * 5);
        for (let t = 0; t < termCount; t++) {
            const term = randomWord();
            tokens.set(term, createTokenMetadata(
                Math.random() > 0.7 ? 1 : 0,
                1 + Math.floor(Math.random() * 3),
                8,
                150,
                1 << (t % 16),
                10 + Math.floor(Math.random() * 40)
            ));
        }

        scorer.indexDocument(`doc_${i}`, docMeta, tokens);
    }

    return scorer;
}

function setupMediumCorpus() {
    const corpusStats = createCorpusStats(1000);
    const scorer = new ResoRankScorer({}, corpusStats);

    for (let i = 0; i < 1000; i++) {
        const docMeta = createDocumentMetadata(10, 200);
        const tokens = new Map<string, TokenMetadata>();

        const termCount = 8 + Math.floor(Math.random() * 7);
        for (let t = 0; t < termCount; t++) {
            const term = randomWord();
            tokens.set(term, createTokenMetadata(
                Math.random() > 0.6 ? 1 : 0,
                1 + Math.floor(Math.random() * 5),
                10,
                200,
                1 << (t % 16),
                50 + Math.floor(Math.random() * 200)
            ));
        }

        scorer.indexDocument(`doc_${i}`, docMeta, tokens);
    }

    return scorer;
}

function setupLargeCorpus() {
    const corpusStats = createCorpusStats(10000);
    const scorer = new ResoRankScorer({}, corpusStats);

    for (let i = 0; i < 10000; i++) {
        const docMeta = createDocumentMetadata(12, 300);
        const tokens = new Map<string, TokenMetadata>();

        const termCount = 10 + Math.floor(Math.random() * 10);
        for (let t = 0; t < termCount; t++) {
            const term = randomWord();
            tokens.set(term, createTokenMetadata(
                Math.random() > 0.5 ? 1 : 0,
                1 + Math.floor(Math.random() * 8),
                12,
                300,
                1 << (t % 16),
                100 + Math.floor(Math.random() * 500)
            ));
        }

        scorer.indexDocument(`doc_${i}`, docMeta, tokens);
    }

    return scorer;
}

// =============================================================================
// Benchmarks
// =============================================================================

describe('Math Utilities', () => {
    const testNumbers = Array.from({ length: 1000 }, () => Math.floor(Math.random() * 0xffffffff));

    bench('popCount', () => {
        for (const n of testNumbers) {
            popCount(n);
        }
    });

    bench('calculateIdf', () => {
        for (let i = 1; i <= 1000; i++) {
            calculateIdf(10000, i);
        }
    });
});

describe('Phrase Detection', () => {
    const adjacentMasks = new Map<string, number>([
        ['hello', 0b0001],
        ['world', 0b0010],
        ['foo', 0b0100],
        ['bar', 0b1000],
    ]);

    const nonAdjacentMasks = new Map<string, number>([
        ['hello', 0b0001],
        ['world', 0b0100],
        ['foo', 0b0001],
        ['bar', 0b1000],
    ]);

    bench('detectPhraseMatch - 2 terms (match)', () => {
        detectPhraseMatch(['hello', 'world'], adjacentMasks);
    });

    bench('detectPhraseMatch - 4 terms (match)', () => {
        detectPhraseMatch(['hello', 'world', 'foo', 'bar'], adjacentMasks);
    });

    bench('detectPhraseMatch - 2 terms (no match)', () => {
        detectPhraseMatch(['hello', 'world'], nonAdjacentMasks);
    });
});

describe('Single Document Scoring', () => {
    const corpusStats = createCorpusStats(100);
    const scorer = new ResoRankScorer({}, corpusStats);

    const docMeta = createDocumentMetadata(10, 150);
    const tokens = new Map<string, TokenMetadata>([
        ['quick', createTokenMetadata(1, 2, 10, 150, 0b0001, 10)],
        ['brown', createTokenMetadata(1, 1, 10, 150, 0b0010, 15)],
        ['fox', createTokenMetadata(0, 3, 10, 150, 0b0011, 5)],
        ['jumps', createTokenMetadata(0, 1, 10, 150, 0b0100, 20)],
        ['lazy', createTokenMetadata(0, 2, 10, 150, 0b1000, 25)],
    ]);

    scorer.indexDocument('test_doc', docMeta, tokens);

    bench('score - single term (fast path)', () => {
        scorer.score(['quick'], 'test_doc');
    });

    bench('score - 2 terms', () => {
        scorer.score(['quick', 'brown'], 'test_doc');
    });

    bench('score - 3 terms', () => {
        scorer.score(['quick', 'brown', 'fox'], 'test_doc');
    });

    bench('score - 5 terms', () => {
        scorer.score(['quick', 'brown', 'fox', 'jumps', 'lazy'], 'test_doc');
    });

    bench('explainScore - 3 terms', () => {
        scorer.explainScore(['quick', 'brown', 'fox'], 'test_doc');
    });
});

describe('Corpus Search - Small (100 docs)', () => {
    const scorer = setupSmallCorpus();

    bench('search - 1 term', () => {
        scorer.search(['search'], 10);
    });

    bench('search - 2 terms', () => {
        scorer.search(['search', 'engine'], 10);
    });

    bench('search - 3 terms', () => {
        scorer.search(['search', 'engine', 'ranking'], 10);
    });

    bench('searchWithExplanations - 2 terms', () => {
        scorer.searchWithExplanations(['search', 'engine'], 10);
    });
});

describe('Corpus Search - Medium (1000 docs)', () => {
    const scorer = setupMediumCorpus();

    bench('search - 1 term', () => {
        scorer.search(['algorithm'], 10);
    });

    bench('search - 2 terms', () => {
        scorer.search(['search', 'algorithm'], 10);
    });

    bench('search - 3 terms', () => {
        scorer.search(['search', 'algorithm', 'ranking'], 10);
    });
});

describe('Corpus Search - Large (10000 docs)', () => {
    const scorer = setupLargeCorpus();

    bench('search - 1 term', () => {
        scorer.search(['query'], 10);
    });

    bench('search - 2 terms', () => {
        scorer.search(['query', 'document'], 10);
    });

    bench('search - 3 terms', () => {
        scorer.search(['query', 'document', 'score'], 10);
    });

    bench('search - top 50 results', () => {
        scorer.search(['search', 'engine'], 50);
    });
});

describe('IDF Cache Performance', () => {
    const corpusStats = createCorpusStats(1000);

    bench('cold cache - 100 unique frequencies', () => {
        const scorer = new ResoRankScorer({}, corpusStats);
        const docMeta = createDocumentMetadata(10, 150);

        for (let i = 0; i < 100; i++) {
            const tokens = new Map<string, TokenMetadata>([
                [`term_${i}`, createTokenMetadata(1, 1, 10, 150, 1, i + 1)],
            ]);
            scorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }

        // Score triggering IDF calculations
        for (let i = 0; i < 100; i++) {
            scorer.score([`term_${i}`], `doc_${i}`);
        }
    });

    bench('warm cache - 100 scores', () => {
        const scorer = new ResoRankScorer({}, corpusStats);
        const docMeta = createDocumentMetadata(10, 150);

        for (let i = 0; i < 100; i++) {
            const tokens = new Map<string, TokenMetadata>([
                [`term_${i}`, createTokenMetadata(1, 1, 10, 150, 1, i + 1)],
            ]);
            scorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }

        scorer.warmIdfCache();

        // Score with warmed cache
        for (let i = 0; i < 100; i++) {
            scorer.score([`term_${i}`], `doc_${i}`);
        }
    });
});

describe('Proximity Strategies Comparison', () => {
    const corpusStats = createCorpusStats(100);
    const docMeta = createDocumentMetadata(10, 150);
    const tokens = new Map<string, TokenMetadata>([
        ['quick', createTokenMetadata(1, 2, 10, 150, 0b0011, 10)],
        ['brown', createTokenMetadata(1, 1, 10, 150, 0b0011, 15)],
        ['fox', createTokenMetadata(0, 3, 10, 150, 0b0110, 5)],
    ]);

    const strategies = [
        ProximityStrategy.Global,
        ProximityStrategy.IdfWeighted,
        ProximityStrategy.Pairwise,
        ProximityStrategy.PerTerm,
    ];

    for (const strategy of strategies) {
        bench(`score with ${strategy} strategy`, () => {
            const scorer = new ResoRankScorer({}, corpusStats, strategy);
            scorer.indexDocument('test', docMeta, tokens);
            scorer.score(['quick', 'brown', 'fox'], 'test');
        });
    }
});

describe('Index Operations', () => {
    const corpusStats = createCorpusStats(1000);

    bench('indexDocument - single doc', () => {
        const scorer = new ResoRankScorer({}, corpusStats);
        const docMeta = createDocumentMetadata(10, 150);
        const tokens = new Map<string, TokenMetadata>([
            ['term1', createTokenMetadata(1, 2, 10, 150, 0b0001, 50)],
            ['term2', createTokenMetadata(0, 3, 10, 150, 0b0010, 100)],
            ['term3', createTokenMetadata(1, 1, 10, 150, 0b0100, 75)],
        ]);
        scorer.indexDocument('doc1', docMeta, tokens);
    });

    bench('indexDocument - 100 docs batch', () => {
        const scorer = new ResoRankScorer({}, corpusStats);
        for (let i = 0; i < 100; i++) {
            const docMeta = createDocumentMetadata(10, 150);
            const tokens = new Map<string, TokenMetadata>([
                ['term1', createTokenMetadata(1, 2, 10, 150, 0b0001, 50)],
                ['term2', createTokenMetadata(0, 3, 10, 150, 0b0010, 100)],
            ]);
            scorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }
    });

    bench('removeDocument', () => {
        const scorer = new ResoRankScorer({}, corpusStats);
        for (let i = 0; i < 100; i++) {
            const docMeta = createDocumentMetadata(10, 150);
            const tokens = new Map<string, TokenMetadata>([
                ['term1', createTokenMetadata(1, 2, 10, 150, 0b0001, 50)],
            ]);
            scorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }

        for (let i = 0; i < 100; i++) {
            scorer.removeDocument(`doc_${i}`);
        }
    });
});

// =============================================================================
// Precision Metrics
// =============================================================================

/**
 * Calculate Precision@k - fraction of top k results that are relevant
 */
function precisionAtK(results: Array<{ docId: string; score: number }>, relevant: Set<string>, k: number): number {
    const topK = results.slice(0, k);
    const relevantInTopK = topK.filter(r => relevant.has(r.docId)).length;
    return relevantInTopK / k;
}

/**
 * Calculate NDCG@k - Normalized Discounted Cumulative Gain
 */
function ndcgAtK(results: Array<{ docId: string; score: number }>, relevance: Map<string, number>, k: number): number {
    const dcg = results.slice(0, k).reduce((sum, r, i) => {
        const rel = relevance.get(r.docId) || 0;
        return sum + (Math.pow(2, rel) - 1) / Math.log2(i + 2);
    }, 0);

    // Ideal DCG
    const idealRanking = Array.from(relevance.values()).sort((a, b) => b - a).slice(0, k);
    const idcg = idealRanking.reduce((sum, rel, i) => {
        return sum + (Math.pow(2, rel) - 1) / Math.log2(i + 2);
    }, 0);

    return idcg > 0 ? dcg / idcg : 0;
}

/**
 * Calculate Mean Average Precision
 */
function meanAveragePrecision(results: Array<{ docId: string; score: number }>, relevant: Set<string>): number {
    let sumPrecision = 0;
    let relevantFound = 0;

    for (let i = 0; i < results.length; i++) {
        if (relevant.has(results[i].docId)) {
            relevantFound++;
            sumPrecision += relevantFound / (i + 1);
        }
    }

    return relevant.size > 0 ? sumPrecision / relevant.size : 0;
}

describe('Precision Metrics', () => {
    // Create a corpus with known relevance
    const corpusStats = createCorpusStats(500);
    const scorer = new ResoRankScorer({}, corpusStats);

    // Index documents with predictable relevance patterns
    const relevantDocs = new Set<string>();
    const relevanceScores = new Map<string, number>();

    // Setup: highly relevant docs (3), moderately relevant (2), slightly relevant (1)
    for (let i = 0; i < 500; i++) {
        const docMeta = createDocumentMetadata(10, 150);
        const tokens = new Map<string, TokenMetadata>();

        // High relevance: contains all query terms with high TF
        if (i < 10) {
            tokens.set('search', createTokenMetadata(2, 5, 10, 150, 0b0011, 50));
            tokens.set('engine', createTokenMetadata(1, 3, 10, 150, 0b0110, 60));
            tokens.set('ranking', createTokenMetadata(1, 2, 10, 150, 0b1100, 40));
            relevantDocs.add(`doc_${i}`);
            relevanceScores.set(`doc_${i}`, 3);
        }
        // Medium relevance: contains 2 terms
        else if (i < 50) {
            tokens.set('search', createTokenMetadata(1, 2, 10, 150, 0b0001, 50));
            tokens.set('engine', createTokenMetadata(0, 1, 10, 150, 0b0010, 60));
            relevantDocs.add(`doc_${i}`);
            relevanceScores.set(`doc_${i}`, 2);
        }
        // Low relevance: contains 1 term
        else if (i < 150) {
            tokens.set('search', createTokenMetadata(0, 1, 10, 150, 0b0001, 50));
            relevanceScores.set(`doc_${i}`, 1);
        }
        // No relevance: other terms
        else {
            tokens.set('other', createTokenMetadata(1, 2, 10, 150, 0b0001, 200));
            tokens.set('terms', createTokenMetadata(0, 1, 10, 150, 0b0010, 180));
        }

        scorer.indexDocument(`doc_${i}`, docMeta, tokens);
    }

    bench('Precision@10 calculation', () => {
        const results = scorer.search(['search', 'engine', 'ranking'], 50);
        precisionAtK(results, relevantDocs, 10);
    });

    bench('NDCG@10 calculation', () => {
        const results = scorer.search(['search', 'engine', 'ranking'], 50);
        ndcgAtK(results, relevanceScores, 10);
    });

    bench('MAP calculation', () => {
        const results = scorer.search(['search', 'engine', 'ranking'], 50);
        meanAveragePrecision(results, relevantDocs);
    });

    bench('Strategy comparison - IdfWeighted precision', () => {
        const idfScorer = new ResoRankScorer({}, corpusStats, ProximityStrategy.IdfWeighted);
        for (let i = 0; i < 100; i++) {
            const docMeta = createDocumentMetadata(10, 150);
            const tokens = new Map<string, TokenMetadata>();
            if (i < 20) {
                tokens.set('test', createTokenMetadata(1, i + 1, 10, 150, 0b0011, 30));
                tokens.set('query', createTokenMetadata(1, 1, 10, 150, 0b0110, 40));
            } else {
                tokens.set('test', createTokenMetadata(0, 1, 10, 150, 0b0001, 30));
            }
            idfScorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }
        const results = idfScorer.search(['test', 'query'], 20);
        precisionAtK(results, new Set([...Array(20).keys()].map(i => `doc_${i}`)), 10);
    });

    bench('Strategy comparison - Pairwise precision', () => {
        const pairwiseScorer = new ResoRankScorer({}, corpusStats, ProximityStrategy.Pairwise);
        for (let i = 0; i < 100; i++) {
            const docMeta = createDocumentMetadata(10, 150);
            const tokens = new Map<string, TokenMetadata>();
            if (i < 20) {
                tokens.set('test', createTokenMetadata(1, i + 1, 10, 150, 0b0011, 30));
                tokens.set('query', createTokenMetadata(1, 1, 10, 150, 0b0110, 40));
            } else {
                tokens.set('test', createTokenMetadata(0, 1, 10, 150, 0b0001, 30));
            }
            pairwiseScorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }
        const results = pairwiseScorer.search(['test', 'query'], 20);
        precisionAtK(results, new Set([...Array(20).keys()].map(i => `doc_${i}`)), 10);
    });
});

// =============================================================================
// Memory Footprint
// =============================================================================

describe('Memory Footprint', () => {
    const corpusStats = createCorpusStats(1000);

    bench('Index 100 docs - memory baseline', () => {
        const scorer = new ResoRankScorer({}, corpusStats);
        for (let i = 0; i < 100; i++) {
            const docMeta = createDocumentMetadata(10, 150);
            const tokens = new Map<string, TokenMetadata>([
                ['term1', createTokenMetadata(1, 2, 10, 150, 0b0001, 50)],
                ['term2', createTokenMetadata(0, 1, 10, 150, 0b0010, 100)],
                ['term3', createTokenMetadata(1, 1, 10, 150, 0b0100, 75)],
            ]);
            scorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }
        // Force stats calculation to ensure all structures are populated
        scorer.getStats();
    });

    bench('Index 500 docs - 5 terms each', () => {
        const scorer = new ResoRankScorer({}, corpusStats);
        for (let i = 0; i < 500; i++) {
            const docMeta = createDocumentMetadata(10, 200);
            const tokens = new Map<string, TokenMetadata>([
                [`term_${i % 50}`, createTokenMetadata(1, 2, 10, 200, 0b0001, 50 + (i % 50))],
                [`word_${i % 30}`, createTokenMetadata(0, 1, 10, 200, 0b0010, 100 + (i % 30))],
                [`content_${i % 20}`, createTokenMetadata(1, 1, 10, 200, 0b0100, 75 + (i % 20))],
                ['common', createTokenMetadata(0, 1, 10, 200, 0b1000, 400)],
                ['frequent', createTokenMetadata(1, 3, 10, 200, 0b0011, 450)],
            ]);
            scorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }
        scorer.warmIdfCache();
        scorer.getStats();
    });

    bench('Index 1000 docs - 10 terms each (heavy)', () => {
        const scorer = new ResoRankScorer({}, corpusStats);
        for (let i = 0; i < 1000; i++) {
            const docMeta = createDocumentMetadata(15, 300);
            const tokens = new Map<string, TokenMetadata>();
            for (let t = 0; t < 10; t++) {
                tokens.set(`term_${(i * t) % 100}`, createTokenMetadata(
                    t % 3 === 0 ? 1 : 0,
                    1 + (t % 5),
                    15,
                    300,
                    1 << (t % 16),
                    50 + (t * 10)
                ));
            }
            scorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }
        scorer.warmIdfCache();
        scorer.getStats();
    });

    bench('IDF cache memory - 100 unique frequencies', () => {
        const scorer = new ResoRankScorer({}, corpusStats);
        const docMeta = createDocumentMetadata(10, 150);
        for (let i = 0; i < 100; i++) {
            const tokens = new Map<string, TokenMetadata>([
                [`unique_${i}`, createTokenMetadata(1, 1, 10, 150, 0b0001, i + 1)],
            ]);
            scorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }
        scorer.warmIdfCache();
        scorer.getStats();
    });
});

// =============================================================================
// Real-World Query Mix (70% single, 20% 2-3 term, 10% phrase)
// =============================================================================

describe('Real-World Query Mix', () => {
    const corpusStats = createCorpusStats(1000);
    const scorer = new ResoRankScorer({}, corpusStats);

    // Build realistic corpus
    const singleTermQueries = ['search', 'query', 'document', 'engine', 'index', 'ranking', 'score'];
    const twoTermQueries = [['search', 'engine'], ['query', 'document'], ['ranking', 'score']];
    const threeTermQueries = [['search', 'engine', 'ranking'], ['query', 'document', 'score']];
    const phraseQueries = [['machine', 'learning'], ['natural', 'language'], ['information', 'retrieval']];

    // Index documents
    for (let i = 0; i < 1000; i++) {
        const docMeta = createDocumentMetadata(10, 200);
        const tokens = new Map<string, TokenMetadata>();

        // Each doc has 5-15 terms from vocabulary
        const termCount = 5 + Math.floor(Math.random() * 10);
        const allTerms = [...singleTermQueries, 'machine', 'learning', 'natural', 'language', 'information', 'retrieval', 'algorithm', 'data', 'system'];

        for (let t = 0; t < termCount; t++) {
            const term = allTerms[(i + t) % allTerms.length];
            // Create phrase-compatible segment masks for adjacent terms
            const segmentBase = t % 14;
            tokens.set(term, createTokenMetadata(
                Math.random() > 0.7 ? 1 : 0,
                1 + Math.floor(Math.random() * 3),
                10,
                200,
                (1 << segmentBase) | (1 << (segmentBase + 1)),
                30 + (allTerms.indexOf(term) * 20)
            ));
        }

        scorer.indexDocument(`doc_${i}`, docMeta, tokens);
    }

    scorer.warmIdfCache();

    // 70% single-term queries
    bench('Query Mix - 70% single-term', () => {
        for (let i = 0; i < 70; i++) {
            const query = singleTermQueries[i % singleTermQueries.length];
            scorer.search([query], 10);
        }
    });

    // 20% 2-3 term queries
    bench('Query Mix - 20% multi-term (2-3)', () => {
        for (let i = 0; i < 20; i++) {
            if (i % 2 === 0) {
                const query = twoTermQueries[i % twoTermQueries.length];
                scorer.search(query, 10);
            } else {
                const query = threeTermQueries[i % threeTermQueries.length];
                scorer.search(query, 10);
            }
        }
    });

    // 10% phrase queries (adjacent terms)
    bench('Query Mix - 10% phrase queries', () => {
        for (let i = 0; i < 10; i++) {
            const query = phraseQueries[i % phraseQueries.length];
            scorer.search(query, 10);
        }
    });

    // Full realistic mix in single bench
    bench('Query Mix - realistic distribution (100 queries)', () => {
        for (let i = 0; i < 100; i++) {
            if (i < 70) {
                // Single term
                scorer.search([singleTermQueries[i % singleTermQueries.length]], 10);
            } else if (i < 90) {
                // 2-3 terms
                if (i % 2 === 0) {
                    scorer.search(twoTermQueries[i % twoTermQueries.length], 10);
                } else {
                    scorer.search(threeTermQueries[i % threeTermQueries.length], 10);
                }
            } else {
                // Phrase
                scorer.search(phraseQueries[i % phraseQueries.length], 10);
            }
        }
    });

    bench('Query Mix - with explanations (100 queries)', () => {
        for (let i = 0; i < 100; i++) {
            if (i < 70) {
                scorer.searchWithExplanations([singleTermQueries[i % singleTermQueries.length]], 10);
            } else if (i < 90) {
                scorer.searchWithExplanations(twoTermQueries[i % twoTermQueries.length], 10);
            } else {
                scorer.searchWithExplanations(phraseQueries[i % phraseQueries.length], 10);
            }
        }
    });
});

describe('Incremental Scorer', () => {
    const corpusStats = createCorpusStats(1000);

    bench('incremental scoring - 3 terms, 100 docs', () => {
        const scorer = new ResoRankIncrementalScorer({}, corpusStats);

        // Term 1
        for (let i = 0; i < 100; i++) {
            scorer.addFieldContribution(`doc_${i}`, 0, 1, 10, 0b0001, 160);
            scorer.addFieldContribution(`doc_${i}`, 1, 2, 150, 0b0001, 160);
        }
        scorer.finalizeTerm(50);
        scorer.nextTerm();

        // Term 2
        for (let i = 0; i < 80; i++) {
            scorer.addFieldContribution(`doc_${i}`, 1, 1, 150, 0b0010, 160);
        }
        scorer.finalizeTerm(80);
        scorer.nextTerm();

        // Term 3
        for (let i = 0; i < 60; i++) {
            scorer.addFieldContribution(`doc_${i}`, 1, 3, 150, 0b0100, 160);
        }
        scorer.finalizeTerm(60);

        scorer.getScores();
    });

    bench('incremental scoring with explanations', () => {
        const scorer = new ResoRankIncrementalScorer({}, corpusStats);

        for (let i = 0; i < 50; i++) {
            scorer.addFieldContribution(`doc_${i}`, 0, 1, 10, 0b0011, 160);
            scorer.addFieldContribution(`doc_${i}`, 1, 2, 150, 0b0011, 160);
        }
        scorer.finalizeTerm(50);
        scorer.nextTerm();

        for (let i = 0; i < 50; i++) {
            scorer.addFieldContribution(`doc_${i}`, 1, 1, 150, 0b0110, 160);
        }
        scorer.finalizeTerm(40);

        scorer.getScoresWithExplanations();
    });
});

describe('BM𝒳 Performance', () => {
    const corpusStats = createCorpusStats(1000);

    bench('BM𝒳 Scorer - search (1 term)', () => {
        const scorer = createBMXScorer(corpusStats);
        // Index some docs
        for (let i = 0; i < 100; i++) {
            const tokens = new Map<string, TokenMetadata>();
            tokens.set('search', createTokenMetadata(1, 2, 8, 150, 1, 50));
            scorer.indexDocument(`doc_${i}`, createDocumentMetadata(8, 150), tokens);
        }
        scorer.search(['search'], 10);
    });

    bench('BM𝒳 Scorer - search (3 terms)', () => {
        const scorer = createBMXScorer(corpusStats);
        for (let i = 0; i < 100; i++) {
            const tokens = new Map<string, TokenMetadata>();
            tokens.set('search', createTokenMetadata(1, 2, 8, 150, 1, 50));
            tokens.set('engine', createTokenMetadata(0, 1, 8, 150, 2, 60));
            tokens.set('ranking', createTokenMetadata(1, 0, 8, 150, 4, 40));
            scorer.indexDocument(`doc_${i}`, createDocumentMetadata(8, 150), tokens);
        }
        scorer.search(['search', 'engine', 'ranking'], 10);
    });

    bench('BM𝒳 Scorer - search with WQA (1 original, 1 augmented)', () => {
        const scorer = createBMXScorer(corpusStats);
        for (let i = 0; i < 100; i++) {
            const tokens = new Map<string, TokenMetadata>();
            tokens.set('search', createTokenMetadata(1, 2, 8, 150, 1, 50));
            tokens.set('find', createTokenMetadata(0, 1, 8, 150, 2, 70));
            scorer.indexDocument(`doc_${i}`, createDocumentMetadata(8, 150), tokens);
        }
        scorer.search(['search'], {
            augmentedQueries: [{ query: ['find'], weight: 0.5 }],
            limit: 10
        });
    });

    bench('BM𝒳 entropy precomputation (1000 terms)', () => {
        const scorer = createBMXScorer(corpusStats);
        const docMeta = createDocumentMetadata(10, 150);
        for (let i = 0; i < 1000; i++) {
            const tokens = new Map<string, TokenMetadata>();
            tokens.set(`term_${i}`, createTokenMetadata(1, 1, 10, 150, 1, 10));
            scorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }
        scorer.precomputeEntropies();
    });
});
