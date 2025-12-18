/**
 * ResoRank: Resonance-Based Hybrid Scoring System
 * A Quantum-BM25F implementation with IDF-weighted proximity and adaptive segmentation.
 * @version 1.0.0
 * @license MIT
 */

type f32 = number;
type u32 = number;
type usize = number;
type Key = string | number;
type FieldId = number;

// =============================================================================
// Adaptive Configuration System Types
// =============================================================================

export interface CorpusProfile {
    size: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge';
    documentCount: number;
    averageDocumentLength: number;
    vocabularySize: number;
    averageTermFrequency: number;
    queryComplexity: 'simple' | 'moderate' | 'complex';
    updateFrequency: 'static' | 'occasional' | 'realtime';
}

export interface AdaptiveConfig {
    strategy: ProximityStrategy;
    config: ResoRankConfig;
    enableCacheWarming: boolean;
    enableBatchOptimization: boolean;
    enableProgressiveEnhancement: boolean;
    shardingRequired: boolean;
    recommendedShards?: number;
}

export interface QueryCharacteristics {
    averageTermCount: number;
    singleTermRatio: number;
    phraseQueryRatio: number;
    multiTermRatio: number;
}

export interface PerformanceMetrics {
    currentQPS: number;
    p50LatencyMs: number;
    p99LatencyMs: number;
    cacheHitRate: number;
    memoryUsageMB: number;
    indexingRateDocsPerSec: number;
}

// =============================================================================
// Corpus Size Thresholds
// =============================================================================

export const CORPUS_SIZE_THRESHOLDS = {
    tiny: 100,
    small: 1_000,
    medium: 10_000,
    large: 100_000,
    xlarge: Infinity,
} as const;

export const CAPACITY_ESTIMATES = {
    tiny: { maxQPS: 178_000, p99LatencyMs: 0.02 },
    small: { maxQPS: 8_000, p99LatencyMs: 0.3 },
    medium: { maxQPS: 450, p99LatencyMs: 4 },
    large: { maxQPS: 45, p99LatencyMs: 40 },
    xlarge: { maxQPS: 10, p99LatencyMs: 200 },
} as const;

// =============================================================================
// Configuration
// =============================================================================

export interface FieldParams {
    weight: f32;
    b: f32;
}

export interface ResoRankConfig {
    /** BM25 k1 parameter (term saturation). Default: 1.2 */
    k1: f32;
    /** Strength of proximity boosting. Default: 0.5 */
    proximityAlpha: f32;
    /** Maximum number of segments for proximity masks (max 32). Default: 16 */
    maxSegments: u32;
    /** Decay factor for document length in proximity calc. Default: 0.5 */
    proximityDecayLambda: f32;
    /** Configuration for individual fields (id -> params) */
    fieldParams: Map<FieldId, FieldParams>;
    /** IDF scaling factor for proximity weighting. Default: 5.0 */
    idfProximityScale: f32;
    /** Enable exact phrase detection boost. Default: true */
    enablePhraseBoost: boolean;
    /** Multiplier for phrase matches. Default: 1.5 */
    phraseBoostMultiplier: f32;
}

export const RESORANK_DEFAULT_CONFIG: ResoRankConfig = {
    k1: 1.2,
    proximityAlpha: 0.5,
    maxSegments: 16,
    proximityDecayLambda: 0.5,
    fieldParams: new Map([
        [0, { weight: 2.0, b: 0.75 }], // e.g., Title
        [1, { weight: 1.0, b: 0.75 }], // e.g., Body
    ]),
    idfProximityScale: 5.0,
    enablePhraseBoost: true,
    phraseBoostMultiplier: 1.5,
};

/**
 * Production-optimized configuration.
 * Use with ProximityStrategy.Pairwise for best speed/precision ratio.
 */
export const RESORANK_PRODUCTION_CONFIG: ResoRankConfig = {
    k1: 1.2,
    proximityAlpha: 0.5,
    maxSegments: 16,
    proximityDecayLambda: 0.5,
    fieldParams: new Map([
        [0, { weight: 2.0, b: 0.75 }], // Title - higher weight
        [1, { weight: 1.0, b: 0.75 }], // Content - standard weight
    ]),
    idfProximityScale: 5.0,
    enablePhraseBoost: true,
    phraseBoostMultiplier: 1.5,
};

// =============================================================================
// Production Monitoring & Capacity Planning
// =============================================================================

export interface ResoRankMetrics {
    queryLatencyP50: f32;
    queryLatencyP99: f32;
    cacheHitRate: f32;
    indexingRate: f32;
    documentCount: usize;
    termCount: usize;
    idfCacheSize: usize;
}

export interface CapacityEstimate {
    maxQps: f32;
    sustainedQps: f32;
    p99LatencyMs: f32;
    recommendedHeadroom: f32;
}

/**
 * Estimate capacity based on corpus size.
 * Based on benchmark results:
 * - 100 docs: ~155K single-term searches/sec
 * - 1000 docs: ~8.6K single-term searches/sec
 * - 10000 docs: ~437 single-term searches/sec
 */
export function estimateCapacity(documentCount: usize, avgTermsPerQuery: f32 = 1.5): CapacityEstimate {
    // Base QPS for single-term on reference hardware (from benchmarks)
    const baseQps = documentCount <= 100 ? 155000 :
        documentCount <= 1000 ? 8600 :
            documentCount <= 10000 ? 437 :
                437 * (10000 / documentCount); // Linear extrapolation

    // Multi-term penalty (from benchmarks: 2-term is ~6x slower, 3-term is ~9x slower)
    const multiTermPenalty = Math.pow(avgTermsPerQuery, 1.5);

    const maxQps = baseQps / multiTermPenalty;
    const sustainedQps = maxQps * 0.5; // 50% headroom

    // P99 latency estimate (ms)
    const p99LatencyMs = (1000 / maxQps) * 2; // ~2x median

    return {
        maxQps,
        sustainedQps,
        p99LatencyMs,
        recommendedHeadroom: 0.5,
    };
}

/**
 * Factory function to create a production-ready scorer with optimal defaults.
 * 
 * @example
 * ```typescript
 * const scorer = createProductionScorer(corpusStats);
 * scorer.indexDocument(...);
 * scorer.warmIdfCache();
 * const results = scorer.search(query, 10);
 * ```
 */
export function createProductionScorer<K extends Key = string>(
    corpusStats: CorpusStatistics,
    options?: {
        config?: Partial<ResoRankConfig>;
        strategy?: ProximityStrategy;
    }
): ResoRankScorer<K> {
    const config = options?.config ?? RESORANK_PRODUCTION_CONFIG;
    const strategy = options?.strategy ?? ProximityStrategy.Pairwise;

    return new ResoRankScorer<K>(config, corpusStats, strategy);
}

/**
 * Create a precision-optimized scorer for when ranking quality is more important than speed.
 * Uses IdfWeighted strategy with ~2% overhead for better rare-term handling.
 */
export function createPrecisionScorer<K extends Key = string>(
    corpusStats: CorpusStatistics,
    config?: Partial<ResoRankConfig>
): ResoRankScorer<K> {
    return new ResoRankScorer<K>(
        config ?? RESORANK_PRODUCTION_CONFIG,
        corpusStats,
        ProximityStrategy.IdfWeighted
    );
}

/**
 * Create a latency-optimized scorer for real-time applications.
 * Uses Pairwise strategy with phrase boost disabled for minimum overhead.
 */
export function createLatencyScorer<K extends Key = string>(
    corpusStats: CorpusStatistics,
    config?: Partial<ResoRankConfig>
): ResoRankScorer<K> {
    const latencyConfig: ResoRankConfig = {
        ...RESORANK_PRODUCTION_CONFIG,
        ...config,
        enablePhraseBoost: false, // Skip phrase detection overhead
    };

    return new ResoRankScorer<K>(
        latencyConfig,
        corpusStats,
        ProximityStrategy.Pairwise
    );
}

// =============================================================================
// Data Structures
// =============================================================================

export interface TokenMetadata {
    fieldOccurrences: Map<FieldId, { tf: u32; fieldLength: u32 }>;
    segmentMask: u32;
    corpusDocFrequency: usize;
}

export interface DocumentMetadata {
    fieldLengths: Map<FieldId, u32>;
    totalTokenCount: u32;
}

export interface CorpusStatistics {
    totalDocuments: usize;
    averageFieldLengths: Map<FieldId, f32>;
    averageDocumentLength: f32;
}

interface TermWithIdf {
    mask: u32;
    idf: f32;
}

interface DocumentAccumulator {
    bm25Score: f32;
    termMasks: u32[];
    termIdfs: f32[];
    fieldMasks: Map<FieldId, u32[]>;
    documentLength: u32;
}

interface FieldAccumulator {
    tf: u32;
    fieldLength: u32;
    segmentMask: u32;
}

interface IncrementalDocumentAccumulator {
    bm25Score: f32;
    termMasks: u32[];
    termIdfs: f32[];
    fieldMasks: Map<FieldId, u32[]>;
    documentLength: u32;
    fieldContributions: Array<Map<FieldId, FieldAccumulator>>;
}

// =============================================================================
// Score Explanation Types
// =============================================================================

export interface ResoRankTermBreakdown {
    term: string;
    idf: f32;
    aggregatedS: f32;
    saturatedScore: f32;
    segmentMask: string;
    fieldContributions: Array<{
        fieldId: FieldId;
        tf: u32;
        fieldLength: u32;
        normalizedTf: f32;
        weightedContribution: f32;
    }>;
}

export interface ResoRankExplanation {
    totalScore: f32;
    bm25Component: f32;
    proximityMultiplier: f32;
    idfProximityBoost: f32;
    lengthDecay: f32;
    phraseBoost: f32;
    overlapCount: u32;
    termBreakdown: ResoRankTermBreakdown[];
    strategy: ProximityStrategy;
}

// =============================================================================
// Math Utilities
// =============================================================================

function calculateIdf(totalDocuments: f32, docFrequency: usize): f32 {
    if (docFrequency <= 0) return 0;
    const ratio = (totalDocuments - docFrequency + 0.5) / (docFrequency + 0.5);
    return Math.log1p(Math.max(0, ratio));
}

function normalizedTermFrequency(
    tf: u32,
    fieldLength: u32,
    averageFieldLength: f32,
    b: f32
): f32 {
    if (averageFieldLength <= 0 || tf <= 0) return 0;
    const denominator = 1.0 - b + b * (fieldLength / averageFieldLength);
    return denominator > 0 ? tf / denominator : 0;
}

function saturate(aggregatedScore: f32, k1: f32): f32 {
    if (!isFinite(aggregatedScore) || aggregatedScore <= 0) return 0;
    if (k1 <= 0) return aggregatedScore;
    return ((k1 + 1.0) * aggregatedScore) / (k1 + aggregatedScore);
}

function popCount(n: u32): u32 {
    n = n - ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function adaptiveSegmentCount(docLength: u32, tokensPerSegment: u32 = 50): u32 {
    return Math.max(8, Math.min(32, Math.ceil(docLength / tokensPerSegment)));
}

function formatBinary(n: u32, bits: u32 = 16): string {
    return n.toString(2).padStart(bits, '0');
}

// =============================================================================
// Proximity Strategies
// =============================================================================

export enum ProximityStrategy {
    Global = 'global',
    PerTerm = 'per-term',
    Pairwise = 'pairwise',
    IdfWeighted = 'idf-weighted',
}

/** Standard global proximity multiplier */
function globalProximityMultiplier(
    termMasks: u32[],
    alpha: f32,
    maxSegments: u32,
    documentLength: u32,
    averageDocLength: f32,
    decayLambda: f32
): { multiplier: f32; overlapCount: u32; decay: f32 } {
    if (termMasks.length < 2) {
        return { multiplier: 1.0, overlapCount: 0, decay: 1.0 };
    }

    const commonMask = termMasks.reduce((a, b) => a & b, 0xffffffff);
    const overlapCount = popCount(commonMask);
    const maxPossibleOverlap = Math.min(termMasks.length, maxSegments);

    if (maxPossibleOverlap === 0) {
        return { multiplier: 1.0, overlapCount: 0, decay: 1.0 };
    }

    const baseMultiplier = overlapCount / maxPossibleOverlap;
    const lengthRatio = averageDocLength > 0 ? documentLength / averageDocLength : 1;
    const decay = Math.exp(-decayLambda * lengthRatio);

    return {
        multiplier: 1.0 + alpha * baseMultiplier * decay,
        overlapCount,
        decay,
    };
}

/** IDF-weighted proximity: rare term clusters get stronger boost */
function idfWeightedProximityMultiplier(
    termData: TermWithIdf[],
    alpha: f32,
    maxSegments: u32,
    documentLength: u32,
    averageDocLength: f32,
    decayLambda: f32,
    idfScale: f32
): { multiplier: f32; overlapCount: u32; decay: f32; idfBoost: f32 } {
    if (termData.length < 2) {
        return { multiplier: 1.0, overlapCount: 0, decay: 1.0, idfBoost: 1.0 };
    }

    const totalIdf = termData.reduce((sum, t) => sum + t.idf, 0);
    const avgIdf = totalIdf / termData.length;

    const commonMask = termData.reduce((a, b) => a & b.mask, 0xffffffff);
    const overlapCount = popCount(commonMask);
    const maxPossibleOverlap = Math.min(termData.length, maxSegments);

    if (maxPossibleOverlap === 0) {
        return { multiplier: 1.0, overlapCount: 0, decay: 1.0, idfBoost: 1.0 };
    }

    const baseMultiplier = overlapCount / maxPossibleOverlap;
    const idfBoost = 1 + avgIdf / idfScale;
    const lengthRatio = averageDocLength > 0 ? documentLength / averageDocLength : 1;
    const decay = Math.exp(-decayLambda * lengthRatio);

    return {
        multiplier: 1.0 + alpha * baseMultiplier * idfBoost * decay,
        overlapCount,
        decay,
        idfBoost,
    };
}

/** Per-term proximity multiplier */
function perTermProximityMultiplier(
    termMask: u32,
    otherMasks: u32[],
    alpha: f32,
    maxSegments: u32
): f32 {
    if (otherMasks.length === 0) return 1.0;

    let totalOverlap = 0;
    for (const other of otherMasks) {
        totalOverlap += popCount(termMask & other);
    }

    const averageOverlap = totalOverlap / otherMasks.length;
    const normalizedOverlap = maxSegments > 0 ? averageOverlap / maxSegments : 0;

    return 1.0 + alpha * normalizedOverlap;
}

/** Pairwise proximity bonus */
function pairwiseProximityBonus(termMasks: u32[], alpha: f32, maxSegments: u32): f32 {
    if (termMasks.length < 2 || maxSegments === 0) return 0;

    let totalProximity = 0;
    let pairCount = 0;

    for (let i = 0; i < termMasks.length; i++) {
        for (let j = i + 1; j < termMasks.length; j++) {
            const overlap = popCount(termMasks[i] & termMasks[j]);
            totalProximity += overlap / maxSegments;
            pairCount++;
        }
    }

    return pairCount > 0 ? alpha * (totalProximity / pairCount) : 0;
}

/**
 * Detect if consecutive query terms appear in adjacent segments.
 * Enforces strict order: term[i] must be in segment N, term[i+1] in segment N+1.
 */
function detectPhraseMatch(queryTerms: string[], docTermMasks: Map<string, u32>): boolean {
    if (queryTerms.length < 2) return false;

    for (let i = 0; i < queryTerms.length - 1; i++) {
        const mask1 = docTermMasks.get(queryTerms[i]);
        const mask2 = docTermMasks.get(queryTerms[i + 1]);

        if (mask1 === undefined || mask2 === undefined) return false;

        // Shift mask1 left: 0001 -> 0010. If mask2 has bit at 0010, they are adjacent.
        const strictOrderAdjacent = (mask1 << 1) & mask2;

        // If any pair is NOT adjacent, it's not a phrase match
        if (strictOrderAdjacent === 0) {
            return false;
        }
    }

    return true;
}

// =============================================================================
// Main Scorer Implementation
// =============================================================================

export class ResoRankScorer<K extends Key = string> {
    private config: ResoRankConfig;
    private corpusStats: CorpusStatistics;
    private documentIndex: Map<K, DocumentMetadata> = new Map();
    private tokenIndex: Map<string, Map<K, TokenMetadata>> = new Map();
    private idfCache: Map<string, f32> = new Map();
    private proximityStrategy: ProximityStrategy;

    constructor(
        config: Partial<ResoRankConfig> = {},
        corpusStats: CorpusStatistics,
        proximityStrategy: ProximityStrategy = ProximityStrategy.IdfWeighted
    ) {
        this.config = { ...RESORANK_DEFAULT_CONFIG, ...config };
        this.corpusStats = corpusStats;
        this.proximityStrategy = proximityStrategy;
    }

    /**
     * Calculate IDF or retrieve from cache.
     * Note: IDF depends only on document frequency and total docs,
     * so cache key is just the frequency count.
     */
    private getOrCalculateIdf(corpusDocFreq: usize): f32 {
        const cacheKey = `${corpusDocFreq}`;
        const cached = this.idfCache.get(cacheKey);
        if (cached !== undefined) return cached;

        const idf = calculateIdf(this.corpusStats.totalDocuments, corpusDocFreq);
        this.idfCache.set(cacheKey, idf);
        return idf;
    }

    /**
     * Pre-compute IDF values for all currently indexed terms.
     * Call this after bulk indexing is complete.
     */
    warmIdfCache(): void {
        const uniqueFrequencies = new Set<usize>();
        for (const termDocs of this.tokenIndex.values()) {
            for (const meta of termDocs.values()) {
                uniqueFrequencies.add(meta.corpusDocFrequency);
            }
        }
        for (const freq of uniqueFrequencies) {
            this.getOrCalculateIdf(freq);
        }
    }

    clearIdfCache(): void {
        this.idfCache.clear();
    }

    /** Remap a segment mask from one granularity to another (Safe). */
    private remapSegmentMask(mask: u32, fromSegments: u32, toSegments: u32): u32 {
        if (fromSegments === toSegments || fromSegments === 0) return mask;

        let newMask = 0;
        for (let i = 0; i < fromSegments; i++) {
            if (mask & (1 << i)) {
                const mappedBit = Math.floor((i / fromSegments) * toSegments);
                // Guard against overflow: JS bitwise ops are 32-bit
                if (mappedBit < 32) {
                    newMask |= 1 << mappedBit;
                }
            }
        }
        return newMask;
    }

    /** Index a document for later scoring */
    indexDocument(
        docId: K,
        docMeta: DocumentMetadata,
        tokens: Map<string, TokenMetadata>,
        useAdaptiveSegments: boolean = false
    ): void {
        this.documentIndex.set(docId, docMeta);

        const effectiveMaxSegments = useAdaptiveSegments
            ? adaptiveSegmentCount(docMeta.totalTokenCount)
            : this.config.maxSegments;

        for (const [term, meta] of tokens) {
            const adjustedMask = useAdaptiveSegments
                ? this.remapSegmentMask(meta.segmentMask, this.config.maxSegments, effectiveMaxSegments)
                : meta.segmentMask;

            if (!this.tokenIndex.has(term)) {
                this.tokenIndex.set(term, new Map());
            }

            this.tokenIndex.get(term)!.set(docId, {
                ...meta,
                segmentMask: adjustedMask,
            });
        }
    }

    /** Remove a document from the index */
    removeDocument(docId: K): boolean {
        const existed = this.documentIndex.delete(docId);

        for (const termDocs of this.tokenIndex.values()) {
            termDocs.delete(docId);
        }

        return existed;
    }

    /** Score a document against a query */
    score(query: string[], docId: K): f32 {
        // Fast path for single-term queries: Skip proximity and object allocation
        if (query.length === 1) {
            return this.scoreSingleTerm(query[0], docId);
        }

        const explanation = this.explainScore(query, docId);
        return explanation.totalScore;
    }

    private scoreSingleTerm(term: string, docId: K): f32 {
        const tokenMeta = this.getTokenMetadata(term, docId);
        if (!tokenMeta) return 0;

        const idf = this.getOrCalculateIdf(tokenMeta.corpusDocFrequency);

        let aggregatedS = 0;
        for (const [fieldId, fieldData] of tokenMeta.fieldOccurrences) {
            const params = this.config.fieldParams.get(fieldId);
            if (!params) continue;

            const avgLen = this.corpusStats.averageFieldLengths.get(fieldId) || 1;
            const normalizedTf = normalizedTermFrequency(
                fieldData.tf,
                fieldData.fieldLength,
                avgLen,
                params.b
            );

            aggregatedS += params.weight * normalizedTf;
        }

        return idf * saturate(aggregatedS, this.config.k1);
    }

    /** Score with full explanation for debugging and tuning */
    explainScore(query: string[], docId: K): ResoRankExplanation {
        const docMeta = this.documentIndex.get(docId);
        if (!docMeta) {
            return this.emptyExplanation();
        }

        const accumulator: DocumentAccumulator = {
            bm25Score: 0,
            termMasks: [],
            termIdfs: [],
            fieldMasks: new Map(),
            documentLength: docMeta.totalTokenCount,
        };

        const termBreakdown: ResoRankTermBreakdown[] = [];
        const docTermMasks = new Map<string, u32>();

        for (let i = 0; i < query.length; i++) {
            const term = query[i];

            const { termScore, breakdown } = this.scoreTermBM25FWithExplanation(
                term,
                docId,
                accumulator
            );

            if (breakdown) {
                termBreakdown.push(breakdown);
                docTermMasks.set(term, breakdown.segmentMask ? parseInt(breakdown.segmentMask, 2) : 0);
            }

            if (this.proximityStrategy === ProximityStrategy.PerTerm && termScore > 0) {
                const otherMasks = accumulator.termMasks.slice(0, i);
                const termMeta = this.getTokenMetadata(term, docId);
                if (termMeta) {
                    const proximity = perTermProximityMultiplier(
                        termMeta.segmentMask,
                        otherMasks,
                        this.config.proximityAlpha,
                        this.config.maxSegments
                    );
                    accumulator.bm25Score += termScore * proximity;
                }
            } else {
                accumulator.bm25Score += termScore;
            }
        }

        const proximityResult = this.calculateProximityMultiplier(accumulator);
        let finalScore = accumulator.bm25Score * proximityResult.multiplier;

        let phraseBoost = 1.0;
        if (this.config.enablePhraseBoost && query.length >= 2) {
            if (detectPhraseMatch(query, docTermMasks)) {
                phraseBoost = this.config.phraseBoostMultiplier;
                finalScore *= phraseBoost;
            }
        }

        return {
            totalScore: finalScore,
            bm25Component: accumulator.bm25Score,
            proximityMultiplier: proximityResult.multiplier,
            idfProximityBoost: proximityResult.idfBoost,
            lengthDecay: proximityResult.decay,
            phraseBoost,
            overlapCount: proximityResult.overlapCount,
            termBreakdown,
            strategy: this.proximityStrategy,
        };
    }

    private emptyExplanation(): ResoRankExplanation {
        return {
            totalScore: 0,
            bm25Component: 0,
            proximityMultiplier: 1,
            idfProximityBoost: 1,
            lengthDecay: 1,
            phraseBoost: 1,
            overlapCount: 0,
            termBreakdown: [],
            strategy: this.proximityStrategy,
        };
    }

    private scoreTermBM25FWithExplanation(
        term: string,
        docId: K,
        accumulator: DocumentAccumulator
    ): { termScore: f32; breakdown: ResoRankTermBreakdown | null } {
        const tokenMeta = this.getTokenMetadata(term, docId);
        if (!tokenMeta) {
            return { termScore: 0, breakdown: null };
        }

        accumulator.termMasks.push(tokenMeta.segmentMask);
        const idf = this.getOrCalculateIdf(tokenMeta.corpusDocFrequency);
        accumulator.termIdfs.push(idf);

        let aggregatedS = 0;
        const fieldContributions: ResoRankTermBreakdown['fieldContributions'] = [];

        for (const [fieldId, fieldData] of tokenMeta.fieldOccurrences) {
            const params = this.config.fieldParams.get(fieldId);
            if (!params) continue;

            const avgLen = this.corpusStats.averageFieldLengths.get(fieldId) || 1;
            const normalizedTf = normalizedTermFrequency(
                fieldData.tf,
                fieldData.fieldLength,
                avgLen,
                params.b
            );

            const weightedContribution = params.weight * normalizedTf;
            aggregatedS += weightedContribution;

            fieldContributions.push({
                fieldId,
                tf: fieldData.tf,
                fieldLength: fieldData.fieldLength,
                normalizedTf,
                weightedContribution,
            });

            if (!accumulator.fieldMasks.has(fieldId)) {
                accumulator.fieldMasks.set(fieldId, []);
            }
            accumulator.fieldMasks.get(fieldId)!.push(tokenMeta.segmentMask);
        }

        const saturatedScore = idf * saturate(aggregatedS, this.config.k1);

        const breakdown: ResoRankTermBreakdown = {
            term,
            idf,
            aggregatedS,
            saturatedScore,
            segmentMask: formatBinary(tokenMeta.segmentMask, this.config.maxSegments),
            fieldContributions,
        };

        return { termScore: saturatedScore, breakdown };
    }

    private calculateProximityMultiplier(accumulator: DocumentAccumulator): {
        multiplier: f32;
        overlapCount: u32;
        decay: f32;
        idfBoost: f32;
    } {
        switch (this.proximityStrategy) {
            case ProximityStrategy.Global: {
                const result = globalProximityMultiplier(
                    accumulator.termMasks,
                    this.config.proximityAlpha,
                    this.config.maxSegments,
                    accumulator.documentLength,
                    this.corpusStats.averageDocumentLength,
                    this.config.proximityDecayLambda
                );
                return { ...result, idfBoost: 1.0 };
            }

            case ProximityStrategy.IdfWeighted: {
                const termData: TermWithIdf[] = accumulator.termMasks.map((mask, i) => ({
                    mask,
                    idf: accumulator.termIdfs[i] || 0,
                }));
                return idfWeightedProximityMultiplier(
                    termData,
                    this.config.proximityAlpha,
                    this.config.maxSegments,
                    accumulator.documentLength,
                    this.corpusStats.averageDocumentLength,
                    this.config.proximityDecayLambda,
                    this.config.idfProximityScale
                );
            }

            case ProximityStrategy.Pairwise: {
                const bonus = pairwiseProximityBonus(
                    accumulator.termMasks,
                    this.config.proximityAlpha,
                    this.config.maxSegments
                );
                return {
                    multiplier: 1 + bonus,
                    overlapCount: 0,
                    decay: 1.0,
                    idfBoost: 1.0,
                };
            }

            case ProximityStrategy.PerTerm:
                return { multiplier: 1.0, overlapCount: 0, decay: 1.0, idfBoost: 1.0 };

            default:
                return { multiplier: 1.0, overlapCount: 0, decay: 1.0, idfBoost: 1.0 };
        }
    }

    private getTokenMetadata(term: string, docId: K): TokenMetadata | undefined {
        return this.tokenIndex.get(term)?.get(docId);
    }

    /** Batch score multiple documents for a query */
    scoreQuery(query: string[], docIds: K[]): Map<K, f32> {
        const scores = new Map<K, f32>();

        for (const docId of docIds) {
            const score = this.score(query, docId);
            if (score > 0) {
                scores.set(docId, score);
            }
        }

        return scores;
    }

    /** Find all documents containing any query term and score them */
    search(query: string[], limit: number = 10): Array<{ docId: K; score: f32 }> {
        const candidateDocs = new Set<K>();

        for (const term of query) {
            const termDocs = this.tokenIndex.get(term);
            if (termDocs) {
                for (const docId of termDocs.keys()) {
                    candidateDocs.add(docId);
                }
            }
        }

        const scores = this.scoreQuery(query, Array.from(candidateDocs));

        return Array.from(scores.entries())
            .map(([docId, score]) => ({ docId, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /** Search with full explanations */
    searchWithExplanations(
        query: string[],
        limit: number = 10
    ): Array<{ docId: K; explanation: ResoRankExplanation }> {
        const candidateDocs = new Set<K>();

        for (const term of query) {
            const termDocs = this.tokenIndex.get(term);
            if (termDocs) {
                for (const docId of termDocs.keys()) {
                    candidateDocs.add(docId);
                }
            }
        }

        const results: Array<{ docId: K; explanation: ResoRankExplanation }> = [];

        for (const docId of candidateDocs) {
            const explanation = this.explainScore(query, docId);
            if (explanation.totalScore > 0) {
                results.push({ docId, explanation });
            }
        }

        return results
            .sort((a, b) => b.explanation.totalScore - a.explanation.totalScore)
            .slice(0, limit);
    }

    /** Get corpus statistics */
    getStats(): {
        documentCount: usize;
        termCount: usize;
        idfCacheSize: usize;
    } {
        return {
            documentCount: this.documentIndex.size,
            termCount: this.tokenIndex.size,
            idfCacheSize: this.idfCache.size,
        };
    }
}

// =============================================================================
// Incremental Scorer for Streaming Updates
// =============================================================================

export class ResoRankIncrementalScorer<K extends Key = string> {
    private config: ResoRankConfig;
    private corpusStats: CorpusStatistics;
    private documentAccumulators: Map<K, IncrementalDocumentAccumulator> = new Map();
    private idfCache: Map<string, f32> = new Map();
    private currentTermIndex: number = 0;

    constructor(config: Partial<ResoRankConfig> = {}, corpusStats: CorpusStatistics) {
        this.config = { ...RESORANK_DEFAULT_CONFIG, ...config };
        this.corpusStats = corpusStats;
    }

    private getOrCalculateIdf(corpusDocFreq: usize): f32 {
        const cacheKey = `${corpusDocFreq}`;
        const cached = this.idfCache.get(cacheKey);
        if (cached !== undefined) return cached;

        const idf = calculateIdf(this.corpusStats.totalDocuments, corpusDocFreq);
        this.idfCache.set(cacheKey, idf);
        return idf;
    }

    nextTerm(): void {
        this.currentTermIndex++;
    }

    reset(): void {
        this.currentTermIndex = 0;
        this.documentAccumulators.clear();
    }

    addFieldContribution(
        docId: K,
        fieldId: FieldId,
        tf: u32,
        fieldLength: u32,
        segmentMask: u32,
        documentLength: u32
    ): void {
        if (!this.documentAccumulators.has(docId)) {
            this.documentAccumulators.set(docId, {
                bm25Score: 0,
                termMasks: [],
                termIdfs: [],
                fieldMasks: new Map(),
                documentLength,
                fieldContributions: [],
            });
        }

        const acc = this.documentAccumulators.get(docId)!;

        while (acc.fieldContributions.length <= this.currentTermIndex) {
            acc.fieldContributions.push(new Map());
        }

        acc.fieldContributions[this.currentTermIndex].set(fieldId, {
            tf,
            fieldLength,
            segmentMask,
        });

        if (acc.termMasks.length <= this.currentTermIndex) {
            acc.termMasks.push(segmentMask);
        } else {
            acc.termMasks[this.currentTermIndex] |= segmentMask;
        }

        if (!acc.fieldMasks.has(fieldId)) {
            acc.fieldMasks.set(fieldId, []);
        }

        const fieldMasks = acc.fieldMasks.get(fieldId)!;
        while (fieldMasks.length <= this.currentTermIndex) {
            fieldMasks.push(0);
        }
        fieldMasks[this.currentTermIndex] |= segmentMask;
    }

    finalizeTerm(corpusDocFrequency: usize): void {
        const idf = this.getOrCalculateIdf(corpusDocFrequency);

        for (const [_docId, acc] of this.documentAccumulators) {
            const termContribs = acc.fieldContributions[this.currentTermIndex];
            if (!termContribs || termContribs.size === 0) continue;

            let aggregatedS = 0;

            for (const [fieldId, fieldAcc] of termContribs) {
                const params = this.config.fieldParams.get(fieldId);
                if (!params) continue;

                const avgLen = this.corpusStats.averageFieldLengths.get(fieldId) || 1;
                const normalizedTf = normalizedTermFrequency(
                    fieldAcc.tf,
                    fieldAcc.fieldLength,
                    avgLen,
                    params.b
                );

                aggregatedS += params.weight * normalizedTf;
            }

            const termScore = idf * saturate(aggregatedS, this.config.k1);
            acc.bm25Score += termScore;

            while (acc.termIdfs.length <= this.currentTermIndex) {
                acc.termIdfs.push(0);
            }
            acc.termIdfs[this.currentTermIndex] = idf;
        }
    }

    getScores(strategy: ProximityStrategy = ProximityStrategy.IdfWeighted): Map<K, f32> {
        const results = new Map<K, f32>();

        for (const [docId, acc] of this.documentAccumulators) {
            let finalScore = acc.bm25Score;

            if (strategy === ProximityStrategy.Global) {
                const { multiplier } = globalProximityMultiplier(
                    acc.termMasks,
                    this.config.proximityAlpha,
                    this.config.maxSegments,
                    acc.documentLength,
                    this.corpusStats.averageDocumentLength,
                    this.config.proximityDecayLambda
                );
                finalScore *= multiplier;
            } else if (strategy === ProximityStrategy.IdfWeighted) {
                const termData: TermWithIdf[] = acc.termMasks.map((mask, i) => ({
                    mask,
                    idf: acc.termIdfs[i] || 0,
                }));
                const { multiplier } = idfWeightedProximityMultiplier(
                    termData,
                    this.config.proximityAlpha,
                    this.config.maxSegments,
                    acc.documentLength,
                    this.corpusStats.averageDocumentLength,
                    this.config.proximityDecayLambda,
                    this.config.idfProximityScale
                );
                finalScore *= multiplier;
            } else if (strategy === ProximityStrategy.Pairwise) {
                const bonus = pairwiseProximityBonus(
                    acc.termMasks,
                    this.config.proximityAlpha,
                    this.config.maxSegments
                );
                finalScore *= 1 + bonus;
            }

            if (finalScore > 0) {
                results.set(docId, finalScore);
            }
        }

        return results;
    }

    getScoresWithExplanations(
        strategy: ProximityStrategy = ProximityStrategy.IdfWeighted
    ): Map<K, { score: f32; termCount: usize; overlapCount: u32 }> {
        const results = new Map<K, { score: f32; termCount: usize; overlapCount: u32 }>();

        for (const [docId, acc] of this.documentAccumulators) {
            let finalScore = acc.bm25Score;
            let overlapCount = 0;

            if (strategy === ProximityStrategy.IdfWeighted) {
                const termData: TermWithIdf[] = acc.termMasks.map((mask, i) => ({
                    mask,
                    idf: acc.termIdfs[i] || 0,
                }));
                const result = idfWeightedProximityMultiplier(
                    termData,
                    this.config.proximityAlpha,
                    this.config.maxSegments,
                    acc.documentLength,
                    this.corpusStats.averageDocumentLength,
                    this.config.proximityDecayLambda,
                    this.config.idfProximityScale
                );
                finalScore *= result.multiplier;
                overlapCount = result.overlapCount;
            }

            if (finalScore > 0) {
                results.set(docId, {
                    score: finalScore,
                    termCount: acc.termMasks.length,
                    overlapCount,
                });
            }
        }

        return results;
    }
}

// =============================================================================
// Exported Utilities for Testing
// =============================================================================

export {
    calculateIdf,
    normalizedTermFrequency,
    saturate,
    popCount,
    adaptiveSegmentCount,
    formatBinary,
    detectPhraseMatch,
    globalProximityMultiplier,
    idfWeightedProximityMultiplier,
    perTermProximityMultiplier,
    pairwiseProximityBonus,
};
