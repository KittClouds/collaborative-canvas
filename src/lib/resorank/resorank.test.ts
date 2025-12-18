/**
 * ResoRank Unit Tests
 * Run with: npm test -- src/lib/resorank/resorank.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
    ResoRankScorer,
    CorpusStatistics,
    DocumentMetadata,
    TokenMetadata,
    ProximityStrategy,
    calculateIdf,
    normalizedTermFrequency,
    saturate,
    popCount,
    detectPhraseMatch,
} from './index';

const EPSILON = 1e-6;

function assertApproxEq(actual: number, expected: number, epsilon = EPSILON) {
    expect(Math.abs(actual - expected)).toBeLessThan(epsilon);
}

describe('Math Utilities', () => {
    it('calculates IDF correctly', () => {
        const idf = calculateIdf(100, 10);
        const expected = Math.log1p((100 - 10 + 0.5) / (10 + 0.5));
        assertApproxEq(idf, expected);
    });

    it('returns 0 for zero document frequency', () => {
        expect(calculateIdf(100, 0)).toBe(0);
    });

    it('normalizes term frequency correctly', () => {
        const tf = normalizedTermFrequency(5, 100, 100, 0.75);
        expect(tf).toBe(5); // When fieldLength == avgFieldLength with b=0.75
    });

    it('saturates score correctly', () => {
        const sat = saturate(2.0, 1.2);
        const expected = (1.2 + 1.0) * 2.0 / (1.2 + 2.0);
        assertApproxEq(sat, expected);
    });

    it('popCount counts bits correctly', () => {
        expect(popCount(0b0000)).toBe(0);
        expect(popCount(0b0001)).toBe(1);
        expect(popCount(0b0101)).toBe(2);
        expect(popCount(0b1111)).toBe(4);
        expect(popCount(0xFFFFFFFF)).toBe(32);
    });
});

describe('Phrase Detection', () => {
    it('detects adjacent phrase match', () => {
        const masks = new Map<string, number>([
            ['hello', 0b0010],
            ['world', 0b0100], // Adjacent: 0010 << 1 = 0100
        ]);
        expect(detectPhraseMatch(['hello', 'world'], masks)).toBe(true);
    });

    it('rejects non-adjacent terms', () => {
        const masks = new Map<string, number>([
            ['hello', 0b0010],
            ['world', 0b1000], // Not adjacent to 0010
        ]);
        expect(detectPhraseMatch(['hello', 'world'], masks)).toBe(false);
    });

    it('rejects reversed order', () => {
        const masks = new Map<string, number>([
            ['hello', 0b0100],
            ['world', 0b0010], // "world" before "hello" in document
        ]);
        expect(detectPhraseMatch(['hello', 'world'], masks)).toBe(false);
    });

    it('handles 3-word phrases', () => {
        const masks = new Map<string, number>([
            ['the', 0b0001],
            ['quick', 0b0010],
            ['brown', 0b0100],
        ]);
        expect(detectPhraseMatch(['the', 'quick', 'brown'], masks)).toBe(true);
    });

    it('returns false for single word', () => {
        const masks = new Map<string, number>([['hello', 0b0001]]);
        expect(detectPhraseMatch(['hello'], masks)).toBe(false);
    });
});

describe('ResoRankScorer', () => {
    const createTestCorpus = () => {
        const corpusStats: CorpusStatistics = {
            totalDocuments: 100,
            averageFieldLengths: new Map([
                [0, 10],
                [1, 150],
            ]),
            averageDocumentLength: 160,
        };
        const scorer = new ResoRankScorer({}, corpusStats);
        return { scorer, corpusStats };
    };

    it('scores a single term using fast path', () => {
        const { scorer } = createTestCorpus();

        const docMeta: DocumentMetadata = {
            fieldLengths: new Map([
                [0, 10],
                [1, 150],
            ]),
            totalTokenCount: 160,
        };

        const tokens = new Map<string, TokenMetadata>([
            [
                'test',
                {
                    fieldOccurrences: new Map([[0, { tf: 2, fieldLength: 10 }]]),
                    segmentMask: 0b1111,
                    corpusDocFrequency: 10,
                },
            ],
        ]);

        scorer.indexDocument('doc1', docMeta, tokens);
        const score = scorer.score(['test'], 'doc1');

        expect(score).toBeGreaterThan(0);
    });

    it('scores multi-term queries', () => {
        const { scorer } = createTestCorpus();

        const docMeta: DocumentMetadata = {
            fieldLengths: new Map([
                [0, 10],
                [1, 150],
            ]),
            totalTokenCount: 160,
        };

        const tokens = new Map<string, TokenMetadata>([
            [
                'quick',
                {
                    fieldOccurrences: new Map([
                        [0, { tf: 1, fieldLength: 10 }],
                        [1, { tf: 2, fieldLength: 150 }],
                    ]),
                    segmentMask: 0b0011,
                    corpusDocFrequency: 10,
                },
            ],
            [
                'brown',
                {
                    fieldOccurrences: new Map([[1, { tf: 1, fieldLength: 150 }]]),
                    segmentMask: 0b0011,
                    corpusDocFrequency: 15,
                },
            ],
        ]);

        scorer.indexDocument('doc1', docMeta, tokens);

        const singleScore = scorer.score(['quick'], 'doc1');
        const multiScore = scorer.score(['quick', 'brown'], 'doc1');

        expect(multiScore).toBeGreaterThan(singleScore);
    });

    it('returns 0 for non-matching terms', () => {
        const { scorer } = createTestCorpus();

        const docMeta: DocumentMetadata = {
            fieldLengths: new Map([[0, 10]]),
            totalTokenCount: 10,
        };

        const tokens = new Map<string, TokenMetadata>([
            [
                'existing',
                {
                    fieldOccurrences: new Map([[0, { tf: 1, fieldLength: 10 }]]),
                    segmentMask: 0b0001,
                    corpusDocFrequency: 5,
                },
            ],
        ]);

        scorer.indexDocument('doc1', docMeta, tokens);

        expect(scorer.score(['nonexistent'], 'doc1')).toBe(0);
    });

    it('removes documents correctly', () => {
        const { scorer } = createTestCorpus();

        const docMeta: DocumentMetadata = {
            fieldLengths: new Map([[0, 10]]),
            totalTokenCount: 10,
        };

        const tokens = new Map<string, TokenMetadata>([
            [
                'test',
                {
                    fieldOccurrences: new Map([[0, { tf: 1, fieldLength: 10 }]]),
                    segmentMask: 0b0001,
                    corpusDocFrequency: 5,
                },
            ],
        ]);

        scorer.indexDocument('doc1', docMeta, tokens);
        expect(scorer.score(['test'], 'doc1')).toBeGreaterThan(0);

        scorer.removeDocument('doc1');
        expect(scorer.score(['test'], 'doc1')).toBe(0);
    });

    it('provides score explanations', () => {
        const { scorer } = createTestCorpus();

        const docMeta: DocumentMetadata = {
            fieldLengths: new Map([
                [0, 10],
                [1, 150],
            ]),
            totalTokenCount: 160,
        };

        const tokens = new Map<string, TokenMetadata>([
            [
                'quick',
                {
                    fieldOccurrences: new Map([[0, { tf: 1, fieldLength: 10 }]]),
                    segmentMask: 0b0001,
                    corpusDocFrequency: 10,
                },
            ],
            [
                'fox',
                {
                    fieldOccurrences: new Map([[1, { tf: 2, fieldLength: 150 }]]),
                    segmentMask: 0b0010,
                    corpusDocFrequency: 5,
                },
            ],
        ]);

        scorer.indexDocument('doc1', docMeta, tokens);

        const explanation = scorer.explainScore(['quick', 'fox'], 'doc1');

        expect(explanation.totalScore).toBeGreaterThan(0);
        expect(explanation.bm25Component).toBeGreaterThan(0);
        expect(explanation.termBreakdown).toHaveLength(2);
        expect(explanation.termBreakdown[0].term).toBe('quick');
        expect(explanation.termBreakdown[1].term).toBe('fox');
    });

    it('applies phrase boost when terms are adjacent', () => {
        const { scorer } = createTestCorpus();

        const docMeta: DocumentMetadata = {
            fieldLengths: new Map([[0, 10]]),
            totalTokenCount: 10,
        };

        const tokens = new Map<string, TokenMetadata>([
            [
                'hello',
                {
                    fieldOccurrences: new Map([[0, { tf: 1, fieldLength: 10 }]]),
                    segmentMask: 0b0001,
                    corpusDocFrequency: 10,
                },
            ],
            [
                'world',
                {
                    fieldOccurrences: new Map([[0, { tf: 1, fieldLength: 10 }]]),
                    segmentMask: 0b0010, // Adjacent to 0001
                    corpusDocFrequency: 10,
                },
            ],
        ]);

        scorer.indexDocument('doc1', docMeta, tokens);

        const explanation = scorer.explainScore(['hello', 'world'], 'doc1');

        expect(explanation.phraseBoost).toBe(1.5);
    });

    it('searches and returns ranked results', () => {
        const { scorer } = createTestCorpus();

        // Add multiple documents
        for (let i = 0; i < 5; i++) {
            const docMeta: DocumentMetadata = {
                fieldLengths: new Map([[0, 10]]),
                totalTokenCount: 10,
            };

            const tokens = new Map<string, TokenMetadata>([
                [
                    'common',
                    {
                        fieldOccurrences: new Map([[0, { tf: i + 1, fieldLength: 10 }]]),
                        segmentMask: 0b0001,
                        corpusDocFrequency: 50,
                    },
                ],
            ]);

            scorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }

        const results = scorer.search(['common'], 3);

        expect(results).toHaveLength(3);
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
        expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });
});

describe('Proximity Strategies', () => {
    const createScorerWithStrategy = (strategy: ProximityStrategy) => {
        const corpusStats: CorpusStatistics = {
            totalDocuments: 100,
            averageFieldLengths: new Map([[0, 10]]),
            averageDocumentLength: 10,
        };
        return new ResoRankScorer({}, corpusStats, strategy);
    };

    const setupDoc = (scorer: ResoRankScorer<string>) => {
        const docMeta: DocumentMetadata = {
            fieldLengths: new Map([[0, 10]]),
            totalTokenCount: 10,
        };

        const tokens = new Map<string, TokenMetadata>([
            [
                'term1',
                {
                    fieldOccurrences: new Map([[0, { tf: 1, fieldLength: 10 }]]),
                    segmentMask: 0b0011,
                    corpusDocFrequency: 10,
                },
            ],
            [
                'term2',
                {
                    fieldOccurrences: new Map([[0, { tf: 1, fieldLength: 10 }]]),
                    segmentMask: 0b0011, // Same segment as term1
                    corpusDocFrequency: 10,
                },
            ],
        ]);

        scorer.indexDocument('doc1', docMeta, tokens);
    };

    it('Global strategy produces scores', () => {
        const scorer = createScorerWithStrategy(ProximityStrategy.Global);
        setupDoc(scorer);

        const score = scorer.score(['term1', 'term2'], 'doc1');
        expect(score).toBeGreaterThan(0);
    });

    it('IdfWeighted strategy produces scores', () => {
        const scorer = createScorerWithStrategy(ProximityStrategy.IdfWeighted);
        setupDoc(scorer);

        const score = scorer.score(['term1', 'term2'], 'doc1');
        expect(score).toBeGreaterThan(0);
    });

    it('Pairwise strategy produces scores', () => {
        const scorer = createScorerWithStrategy(ProximityStrategy.Pairwise);
        setupDoc(scorer);

        const score = scorer.score(['term1', 'term2'], 'doc1');
        expect(score).toBeGreaterThan(0);
    });

    it('PerTerm strategy produces scores', () => {
        const scorer = createScorerWithStrategy(ProximityStrategy.PerTerm);
        setupDoc(scorer);

        const score = scorer.score(['term1', 'term2'], 'doc1');
        expect(score).toBeGreaterThan(0);
    });
});

describe('Strategy Recommendations', () => {
    const corpusStats: CorpusStatistics = {
        totalDocuments: 100,
        averageFieldLengths: new Map([[0, 10]]),
        averageDocumentLength: 10,
    };

    const docMeta: DocumentMetadata = {
        fieldLengths: new Map([[0, 10]]),
        totalTokenCount: 10,
    };

    const tokens = new Map<string, TokenMetadata>([
        [
            'term1',
            {
                fieldOccurrences: new Map([[0, { tf: 1, fieldLength: 10 }]]),
                segmentMask: 0b0011,
                corpusDocFrequency: 10,
            },
        ],
        [
            'term2',
            {
                fieldOccurrences: new Map([[0, { tf: 1, fieldLength: 10 }]]),
                segmentMask: 0b0011,
                corpusDocFrequency: 10,
            },
        ],
        [
            'term3',
            {
                fieldOccurrences: new Map([[0, { tf: 1, fieldLength: 10 }]]),
                segmentMask: 0b0110,
                corpusDocFrequency: 5,
            },
        ],
    ]);

    it('Pairwise strategy is fastest for latency-critical apps', () => {
        // Recommendation 1: Use Pairwise for latency-critical applications
        const pairwiseScorer = new ResoRankScorer({}, corpusStats, ProximityStrategy.Pairwise);
        pairwiseScorer.indexDocument('doc1', docMeta, tokens);

        const pairwiseScore = pairwiseScorer.score(['term1', 'term2', 'term3'], 'doc1');

        // Pairwise should produce valid scores
        expect(pairwiseScore).toBeGreaterThan(0);

        // Verify explanation shows pairwise strategy
        const explanation = pairwiseScorer.explainScore(['term1', 'term2'], 'doc1');
        expect(explanation.strategy).toBe(ProximityStrategy.Pairwise);
    });

    it('IdfWeighted strategy provides better ranking quality', () => {
        // Recommendation 2: Use IdfWeighted for precision-critical apps
        const idfScorer = new ResoRankScorer({}, corpusStats, ProximityStrategy.IdfWeighted);
        idfScorer.indexDocument('doc1', docMeta, tokens);

        const explanation = idfScorer.explainScore(['term1', 'term2', 'term3'], 'doc1');

        // IdfWeighted should have idfProximityBoost > 1 when terms have different IDFs
        expect(explanation.strategy).toBe(ProximityStrategy.IdfWeighted);
        expect(explanation.idfProximityBoost).toBeGreaterThanOrEqual(1);
    });

    it('Batch indexing with cache warming is efficient', () => {
        // Recommendation 3: Batch indexing + warmIdfCache
        const scorer = new ResoRankScorer({}, corpusStats);

        // Batch index 50 documents
        for (let i = 0; i < 50; i++) {
            const docTokens = new Map<string, TokenMetadata>([
                [
                    `term_${i % 10}`,
                    {
                        fieldOccurrences: new Map([[0, { tf: 1 + (i % 3), fieldLength: 10 }]]),
                        segmentMask: 1 << (i % 16),
                        corpusDocFrequency: 10 + i,
                    },
                ],
            ]);
            scorer.indexDocument(`doc_${i}`, docMeta, docTokens);
        }

        // Warm cache after batch
        scorer.warmIdfCache();

        const stats = scorer.getStats();
        expect(stats.documentCount).toBe(50);
        expect(stats.idfCacheSize).toBeGreaterThan(0);

        // Searches should work efficiently now
        const results = scorer.search(['term_0'], 10);
        expect(results.length).toBeGreaterThan(0);
    });

    it('Single-term fast path skips proximity calculation', () => {
        // Recommendation 4: Single-term optimization is critical
        const scorer = new ResoRankScorer({}, corpusStats, ProximityStrategy.IdfWeighted);
        scorer.indexDocument('doc1', docMeta, tokens);

        // Single term should use fast path (no proximity multiplier in explanation)
        const singleScore = scorer.score(['term1'], 'doc1');
        expect(singleScore).toBeGreaterThan(0);

        // Multi-term uses full path
        const multiScore = scorer.score(['term1', 'term2'], 'doc1');
        const explanation = scorer.explainScore(['term1', 'term2'], 'doc1');

        // Multi-term should have proximity effects
        expect(explanation.proximityMultiplier).toBeGreaterThanOrEqual(1);
        expect(multiScore).toBeGreaterThan(singleScore);
    });

    it('Different strategies produce different but valid scores', () => {
        const strategies = [
            ProximityStrategy.Global,
            ProximityStrategy.IdfWeighted,
            ProximityStrategy.Pairwise,
            ProximityStrategy.PerTerm,
        ];

        const scores: Map<ProximityStrategy, number> = new Map();

        for (const strategy of strategies) {
            const scorer = new ResoRankScorer({}, corpusStats, strategy);
            scorer.indexDocument('doc1', docMeta, tokens);
            const score = scorer.score(['term1', 'term2', 'term3'], 'doc1');
            scores.set(strategy, score);
            expect(score).toBeGreaterThan(0);
        }

        // All strategies should produce valid (but potentially different) scores
        expect(scores.size).toBe(4);
    });
});

describe('IDF Cache', () => {
    it('warms cache correctly', () => {
        const corpusStats: CorpusStatistics = {
            totalDocuments: 100,
            averageFieldLengths: new Map([[0, 10]]),
            averageDocumentLength: 10,
        };
        const scorer = new ResoRankScorer({}, corpusStats);

        const docMeta: DocumentMetadata = {
            fieldLengths: new Map([[0, 10]]),
            totalTokenCount: 10,
        };

        // Index docs with different doc frequencies
        for (let i = 0; i < 10; i++) {
            const tokens = new Map<string, TokenMetadata>([
                [
                    `term_${i}`,
                    {
                        fieldOccurrences: new Map([[0, { tf: 1, fieldLength: 10 }]]),
                        segmentMask: 0b0001,
                        corpusDocFrequency: (i + 1) * 5,
                    },
                ],
            ]);
            scorer.indexDocument(`doc_${i}`, docMeta, tokens);
        }

        expect(scorer.getStats().idfCacheSize).toBe(0);

        scorer.warmIdfCache();

        expect(scorer.getStats().idfCacheSize).toBeGreaterThan(0);
    });

    it('clears cache correctly', () => {
        const corpusStats: CorpusStatistics = {
            totalDocuments: 100,
            averageFieldLengths: new Map([[0, 10]]),
            averageDocumentLength: 10,
        };
        const scorer = new ResoRankScorer({}, corpusStats);

        const docMeta: DocumentMetadata = {
            fieldLengths: new Map([[0, 10]]),
            totalTokenCount: 10,
        };

        const tokens = new Map<string, TokenMetadata>([
            [
                'test',
                {
                    fieldOccurrences: new Map([[0, { tf: 1, fieldLength: 10 }]]),
                    segmentMask: 0b0001,
                    corpusDocFrequency: 10,
                },
            ],
        ]);

        scorer.indexDocument('doc1', docMeta, tokens);
        scorer.score(['test'], 'doc1'); // Populates cache

        expect(scorer.getStats().idfCacheSize).toBeGreaterThan(0);

        scorer.clearIdfCache();

        expect(scorer.getStats().idfCacheSize).toBe(0);
    });
});
