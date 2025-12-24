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

    // ===== NEW BM𝒳 PARAMETERS =====
    /** Enable BM𝒳 entropy weighting in denominator. Default: false */
    enableBMXEntropy: boolean;
    /** Enable BM𝒳 entropy-weighted similarity boost. Default: false */
    enableBMXSimilarity: boolean;
    /** Use adaptive alpha parameter instead of k1. Default: false */
    useAdaptiveAlpha: boolean;
    /** Weight for entropy in denominator (γ). If null, auto-calculated as α/2. Default: null */
    entropyDenomWeight: f32 | null;
}

export const RESORANK_DEFAULT_CONFIG: ResoRankConfig = {
    k1: 1.2,
    proximityAlpha: 0.5,
    maxSegments: 16,
    proximityDecayLambda: 0.5,
    fieldParams: new Map([
        [0, { weight: 2.0, b: 0.75 }],
        [1, { weight: 1.0, b: 0.75 }],
    ]),
    idfProximityScale: 5.0,
    enablePhraseBoost: true,
    phraseBoostMultiplier: 1.5,
    enableBMXEntropy: false,
    enableBMXSimilarity: false,
    useAdaptiveAlpha: false,
    entropyDenomWeight: null,
};

/**
 * Production-optimized configuration.
 * Use with ProximityStrategy.Pairwise for best speed/precision ratio.
 */
export const RESORANK_PRODUCTION_CONFIG: ResoRankConfig = {
    ...RESORANK_DEFAULT_CONFIG,
    fieldParams: new Map([
        [0, { weight: 2.0, b: 0.75 }], // Title - higher weight
        [1, { weight: 1.0, b: 0.75 }], // Content - standard weight
    ]),
};

/** Full BM𝒳 integration preset */
export const RESORANK_BMX_CONFIG: ResoRankConfig = {
    ...RESORANK_DEFAULT_CONFIG,
    enableBMXEntropy: true,
    enableBMXSimilarity: true,
    useAdaptiveAlpha: true,
    entropyDenomWeight: null, // Auto-calculate
};

/** BM𝒳 with Weighted Query Augmentation preset */
export const RESORANK_BMX_SEMANTIC_CONFIG: ResoRankConfig = {
    ...RESORANK_BMX_CONFIG,
};

/** Conservative BM𝒳 adoption: entropy only */
export const RESORANK_BMX_ENTROPY_ONLY_CONFIG: ResoRankConfig = {
    ...RESORANK_DEFAULT_CONFIG,
    enableBMXEntropy: true,
    useAdaptiveAlpha: true,
    enableBMXSimilarity: false,
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
 */
export function estimateCapacity(documentCount: usize, avgTermsPerQuery: f32 = 1.5): CapacityEstimate {
    const baseQps = documentCount <= 100 ? 155000 :
        documentCount <= 1000 ? 8600 :
            documentCount <= 10000 ? 437 :
                437 * (10000 / documentCount);

    const multiTermPenalty = Math.pow(avgTermsPerQuery, 1.5);
    const maxQps = baseQps / multiTermPenalty;
    const sustainedQps = maxQps * 0.5;
    const p99LatencyMs = (1000 / maxQps) * 2;

    return {
        maxQps,
        sustainedQps,
        p99LatencyMs,
        recommendedHeadroom: 0.5,
    };
}

/**
 * UPDATED: Production scorer with optional BM𝒳 features
 */
export function createProductionScorer<K extends Key = string>(
    corpusStats: CorpusStatistics,
    options?: {
        config?: Partial<ResoRankConfig>;
        strategy?: ProximityStrategy;
        enableBMX?: boolean;
    }
): ResoRankScorer<K> {
    if (options?.enableBMX) {
        return createBMXScorer<K>(corpusStats, {
            config: options.config,
            strategy: options.strategy,
            precomputeEntropy: true,
        });
    }

    const config = options?.config ?? RESORANK_PRODUCTION_CONFIG;
    const strategy = options?.strategy ?? ProximityStrategy.Pairwise;
    return new ResoRankScorer<K>(config, corpusStats, strategy);
}

/**
 * UPDATED: Precision scorer with optional BM𝒳
 */
export function createPrecisionScorer<K extends Key = string>(
    corpusStats: CorpusStatistics,
    options?: {
        config?: Partial<ResoRankConfig>;
        enableBMX?: boolean;
    }
): ResoRankScorer<K> {
    if (options?.enableBMX) {
        return createBMXScorer<K>(corpusStats, {
            config: options.config,
            strategy: ProximityStrategy.IdfWeighted,
            precomputeEntropy: true,
        });
    }

    return new ResoRankScorer<K>(
        options?.config ?? RESORANK_PRODUCTION_CONFIG,
        corpusStats,
        ProximityStrategy.IdfWeighted
    );
}

/**
 * UPDATED: Latency scorer
 */
export function createLatencyScorer<K extends Key = string>(
    corpusStats: CorpusStatistics,
    config?: Partial<ResoRankConfig>
): ResoRankScorer<K> {
    const latencyConfig: ResoRankConfig = {
        ...RESORANK_PRODUCTION_CONFIG,
        ...config,
        enablePhraseBoost: false,
        enableBMXEntropy: false,
        enableBMXSimilarity: false,
        useAdaptiveAlpha: false,
    };

    return new ResoRankScorer<K>(
        latencyConfig,
        corpusStats,
        ProximityStrategy.Pairwise
    );
}

/**
 * Create a BM𝒳-enhanced scorer
 */
export function createBMXScorer<K extends Key = string>(
    corpusStats: CorpusStatistics,
    options?: {
        config?: Partial<ResoRankConfig>;
        strategy?: ProximityStrategy;
        precomputeEntropy?: boolean;
    }
): ResoRankScorer<K> {
    const config: ResoRankConfig = {
        ...RESORANK_BMX_CONFIG,
        ...options?.config,
    };

    const strategy = options?.strategy ?? ProximityStrategy.IdfWeighted;
    const scorer = new ResoRankScorer<K>(config, corpusStats, strategy);

    if (options?.precomputeEntropy) {
        scorer.precomputeEntropies();
        scorer.warmIdfCache();
    }

    return scorer;
}

/**
 * Create a BM𝒳 scorer optimized for semantic search with WQA
 */
export function createBMXSemanticScorer<K extends Key = string>(
    corpusStats: CorpusStatistics,
    config?: Partial<ResoRankConfig>
): ResoRankScorer<K> {
    return createBMXScorer<K>(corpusStats, {
        config: {
            ...RESORANK_BMX_SEMANTIC_CONFIG,
            ...config,
        },
        strategy: ProximityStrategy.IdfWeighted,
        precomputeEntropy: true,
    });
}

/**
 * Create a conservative BM𝒳 scorer
 */
export function createBMXEntropyScorer<K extends Key = string>(
    corpusStats: CorpusStatistics,
    config?: Partial<ResoRankConfig>
): ResoRankScorer<K> {
    return createBMXScorer<K>(corpusStats, {
        config: {
            ...RESORANK_BMX_ENTROPY_ONLY_CONFIG,
            ...config,
        },
        strategy: ProximityStrategy.Pairwise,
        precomputeEntropy: true,
    });
}

// =============================================================================
// BM𝒳 Support Types
// =============================================================================

export interface QueryEntropyStats {
    normalizedEntropies: Map<string, f32>;
    avgEntropy: f32;
    sumNormalizedEntropies: f32;
    maxRawEntropy: f32;
}

export interface AugmentedQuery {
    query: string[];
    weight: f32;
    description?: string;
}

export interface SearchOptions {
    limit?: number;
    augmentedQueries?: AugmentedQuery[];
    normalize?: boolean;
    strategy?: ProximityStrategy;
}

/**
 * Query performance metrics for monitoring and debugging
 */
export interface QueryMetrics {
    queryLength: number;
    candidateCount: number;
    scoredDocuments: number;
    totalTimeMs: f32;
    entropyComputeMs?: f32;
    scoringTimeMs?: f32;
    sortingTimeMs?: f32;
    bmxEnabled: boolean;
    wqaEnabled: boolean;
    wqaQueryCount?: number;
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
    // NEW BM𝒳 fields
    entropy?: f32;              // E(qi) - normalized entropy
    rawEntropy?: f32;           // Ẽ(qi) - raw entropy
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
    // NEW BM𝒳 fields
    bmxEntropySimilarityBoost?: f32;  // β × S(Q,D) × Σ E(qi)
    bmxSimilarity?: f32;              // S(Q,D)
    bmxAvgEntropy?: f32;              // ℰ
    bmxAlpha?: f32;                   // α (if adaptive)
    bmxBeta?: f32;                    // β
    normalizedScore?: f32;            // Score normalized to [0,1]
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
    return saturateBMX(aggregatedScore, k1);
}

// =============================================================================
// BM𝒳 Entropy Utilities
// =============================================================================

/** Sigmoid function for entropy calculation */
function sigmoid(x: f32): f32 {
    return 1 / (1 + Math.exp(-x));
}

/** Calculate adaptive alpha parameter (BM𝒳 Equation 3) */
function calculateAdaptiveAlpha(averageDocumentLength: f32): f32 {
    return Math.max(Math.min(1.5, averageDocumentLength / 100), 0.5);
}

/** Calculate beta parameter for similarity boost (BM𝒳 Equation 3) */
function calculateBeta(totalDocuments: usize): f32 {
    return 1 / Math.log(1 + totalDocuments);
}

/** Calculate normalized score (BM𝒳 Equations 10-11) */
function normalizeScore(rawScore: f32, queryLength: number, totalDocuments: usize): f32 {
    const maxIdfApprox = Math.log(1 + (totalDocuments - 0.5) / 1.5);
    const scoreMax = queryLength * (maxIdfApprox + 1.0);
    return scoreMax > 0 ? rawScore / scoreMax : 0;
}

/**
 * Calculate normalized term frequency with optional BM𝒳 entropy adjustment
 * @param tf - Term frequency in field
 * @param fieldLength - Length of field
 * @param averageFieldLength - Average field length in corpus
 * @param b - Length normalization parameter
 * @param avgEntropy - Average normalized entropy (ℰ) from query terms
 * @param gamma - Weight for entropy in denominator (γ)
 */
function normalizedTermFrequencyBMX(
    tf: u32,
    fieldLength: u32,
    averageFieldLength: f32,
    b: f32,
    avgEntropy: f32 = 0,
    gamma: f32 = 0
): f32 {
    if (averageFieldLength <= 0 || tf <= 0) return 0;

    // Standard BM25F length normalization
    const lengthNorm = 1.0 - b + b * (fieldLength / averageFieldLength);

    // BM𝒳 enhancement: add γ × ℰ to denominator
    const denominator = lengthNorm + gamma * avgEntropy;

    return denominator > 0 ? tf / denominator : 0;
}

/**
 * Saturation function with adaptive alpha support
 * @param aggregatedScore - Aggregated field scores
 * @param k1OrAlpha - Saturation parameter (k1 for classic, α for BM𝒳)
 */
function saturateBMX(aggregatedScore: f32, k1OrAlpha: f32): f32 {
    if (!isFinite(aggregatedScore) || aggregatedScore <= 0) return 0;
    if (k1OrAlpha <= 0) return aggregatedScore;
    return ((k1OrAlpha + 1.0) * aggregatedScore) / (k1OrAlpha + aggregatedScore);
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

    // ===== NEW BM𝒳 CACHES =====
    private entropyCache: Map<string, f32> = new Map(); // Raw entropy Ẽ(term)
    private cachedAlpha: f32 | null = null;
    private cachedBeta: f32 | null = null;
    private cachedGamma: f32 | null = null;

    // ===== TELEMETRY =====
    private metricsEnabled: boolean = false;
    private lastQueryMetrics?: QueryMetrics;

    constructor(
        config: Partial<ResoRankConfig> = {},
        corpusStats: CorpusStatistics,
        proximityStrategy: ProximityStrategy = ProximityStrategy.IdfWeighted
    ) {
        this.config = { ...RESORANK_DEFAULT_CONFIG, ...config };
        this.corpusStats = corpusStats;
        this.proximityStrategy = proximityStrategy;

        // Pre-calculate BM𝒳 parameters if enabled
        if (this.config.useAdaptiveAlpha || this.config.enableBMXEntropy || this.config.enableBMXSimilarity) {
            this.cachedAlpha = calculateAdaptiveAlpha(corpusStats.averageDocumentLength);
            this.cachedBeta = calculateBeta(corpusStats.totalDocuments);
            this.cachedGamma = this.config.entropyDenomWeight ?? (this.cachedAlpha / 2);
        }
    }

    /**
     * Enable or disable query performance metrics collection
     */
    enableMetrics(enable: boolean = true): void {
        this.metricsEnabled = enable;
    }

    /**
     * Get metrics from the last search query
     */
    getLastQueryMetrics(): QueryMetrics | undefined {
        return this.lastQueryMetrics;
    }

    /**
     * Pre-compute entropy values for all indexed terms (BM𝒳 Equation 5).
     * Call this after bulk indexing is complete, before warmIdfCache().
     */
    precomputeEntropies(): void {
        if (!this.config.enableBMXEntropy && !this.config.enableBMXSimilarity) {
            return; // Skip if BM𝒳 features disabled
        }

        for (const [term, termDocs] of this.tokenIndex) {
            let rawEntropy = 0;

            for (const [_docId, metadata] of termDocs) {
                // Sum TF across all fields for this document
                let totalTF = 0;
                for (const [_fieldId, fieldData] of metadata.fieldOccurrences) {
                    totalTF += fieldData.tf;
                }

                // Optimization: cap TF since sigmoid saturates above ~10
                if (totalTF > 10) totalTF = 10;

                // Sigmoid probability (BM𝒳 Equation 5)
                const pj = sigmoid(totalTF);

                // Accumulate entropy: -pj × log(pj)
                if (pj > 1e-6 && pj < 0.999999) {
                    rawEntropy += -(pj * Math.log(pj));
                }
            }

            this.entropyCache.set(term, rawEntropy);
        }
    }

    /**
     * Optimized entropy precomputation with batching for large corpora.
     * Allows event loop to breathe between batches in async contexts.
     * @param batchSize Number of terms to process per batch (default: 1000)
     */
    precomputeEntropiesBatched(batchSize: number = 1000): void {
        if (!this.config.enableBMXEntropy && !this.config.enableBMXSimilarity) {
            return;
        }

        const terms = Array.from(this.tokenIndex.keys());

        for (let i = 0; i < terms.length; i += batchSize) {
            const batch = terms.slice(i, i + batchSize);

            for (const term of batch) {
                const termDocs = this.tokenIndex.get(term)!;
                let rawEntropy = 0;

                for (const [_docId, metadata] of termDocs) {
                    let totalTF = 0;
                    for (const [_fieldId, fieldData] of metadata.fieldOccurrences) {
                        totalTF += fieldData.tf;
                    }

                    // Optimization: early exit if sigmoid will saturate
                    if (totalTF > 10) totalTF = 10;

                    const pj = sigmoid(totalTF);
                    if (pj > 1e-6 && pj < 0.999999) {
                        rawEntropy += -(pj * Math.log(pj));
                    }
                }

                this.entropyCache.set(term, rawEntropy);
            }
        }
    }

    /**
     * Clear entropy cache (call if index changes significantly)
     */
    clearEntropyCache(): void {
        this.entropyCache.clear();
    }

    /**
     * Get detailed cache statistics for monitoring
     */
    getCacheStats(): {
        idf: { size: number; memoryMB: number };
        entropy: { size: number; memoryMB: number };
        total: { memoryMB: number };
    } {
        // Estimate: 8 bytes per f32, ~40 bytes overhead per Map entry
        const idfMemory = this.idfCache.size * 48 / (1024 * 1024);
        const entropyMemory = this.entropyCache.size * 48 / (1024 * 1024);

        return {
            idf: {
                size: this.idfCache.size,
                memoryMB: idfMemory
            },
            entropy: {
                size: this.entropyCache.size,
                memoryMB: entropyMemory
            },
            total: {
                memoryMB: idfMemory + entropyMemory
            }
        };
    }

    /**
     * Prune entropy cache for low-frequency terms to reduce memory
     * @param minDocFrequency Minimum document frequency to keep (default: 2)
     * @returns Number of entries pruned
     */
    pruneEntropyCache(minDocFrequency: number = 2): number {
        let pruned = 0;

        for (const [term, _entropy] of this.entropyCache) {
            const termDocs = this.tokenIndex.get(term);
            if (termDocs && termDocs.size < minDocFrequency) {
                this.entropyCache.delete(term);
                pruned++;
            }
        }

        return pruned;
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

        // For single-term queries, avgEntropy = normalized entropy of that term
        let avgEntropy = 0;
        let gamma = 0;

        if (this.config.enableBMXEntropy && this.entropyCache.has(term)) {
            const rawEntropy = this.entropyCache.get(term) ?? 0;
            // For single term, normalized entropy = 1.0 (it's the max)
            avgEntropy = 1.0;
            gamma = this.cachedGamma ?? 0;
        }

        let aggregatedS = 0;
        for (const [fieldId, fieldData] of tokenMeta.fieldOccurrences) {
            const params = this.config.fieldParams.get(fieldId);
            if (!params) continue;

            const avgLen = this.corpusStats.averageFieldLengths.get(fieldId) || 1;

            // Use BM𝒳-enhanced normalization
            const normalizedTf = normalizedTermFrequencyBMX(
                fieldData.tf,
                fieldData.fieldLength,
                avgLen,
                params.b,
                avgEntropy,
                gamma
            );

            aggregatedS += params.weight * normalizedTf;
        }

        // Use adaptive alpha if enabled
        const saturationParam = this.config.useAdaptiveAlpha
            ? (this.cachedAlpha ?? this.config.k1)
            : this.config.k1;

        let score = idf * saturateBMX(aggregatedS, saturationParam);

        // Add similarity boost for single-term (always matches if doc contains term)
        if (this.config.enableBMXSimilarity && this.cachedBeta) {
            // S(Q,D) = 1.0 for single matching term
            const similarityBoost = this.cachedBeta * 1.0 * 1.0; // β × S(Q,D) × E(qi)
            score += similarityBoost;
        }

        return score;
    }

    /** Score with full explanation for debugging and tuning */
    explainScore(query: string[], docId: K): ResoRankExplanation {
        const docMeta = this.documentIndex.get(docId);
        if (!docMeta) {
            return this.emptyExplanation();
        }

        // NEW: Calculate query-level entropy statistics if BM𝒳 enabled
        const entropyStats = (this.config.enableBMXEntropy || this.config.enableBMXSimilarity)
            ? this.calculateQueryEntropyStats(query)
            : undefined;

        const accumulator: DocumentAccumulator = {
            bm25Score: 0,
            termMasks: [],
            termIdfs: [],
            fieldMasks: new Map(),
            documentLength: docMeta.totalTokenCount,
        };

        const termBreakdown: ResoRankTermBreakdown[] = [];
        const docTermMasks = new Map<string, u32>();

        // Score each term with BM𝒳 enhancements
        for (let i = 0; i < query.length; i++) {
            const term = query[i];

            const { termScore, breakdown } = this.scoreTermBM25FWithExplanation(
                term,
                docId,
                accumulator,
                entropyStats  // NEW: pass entropy stats
            );

            if (breakdown) {
                termBreakdown.push(breakdown);
                docTermMasks.set(term, breakdown.segmentMask ? parseInt(breakdown.segmentMask, 2) : 0);
            }

            // Handle PerTerm strategy
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

        // Apply proximity multiplier (unchanged)
        const proximityResult = this.calculateProximityMultiplier(accumulator);
        let finalScore = accumulator.bm25Score * proximityResult.multiplier;

        // Apply phrase boost (unchanged)
        let phraseBoost = 1.0;
        if (this.config.enablePhraseBoost && query.length >= 2) {
            if (detectPhraseMatch(query, docTermMasks)) {
                phraseBoost = this.config.phraseBoostMultiplier;
                finalScore *= phraseBoost;
            }
        }

        // NEW: Add BM𝒳 entropy-weighted similarity boost
        let bmxSimilarityBoost = 0;
        let bmxSimilarity = 0;
        if (this.config.enableBMXSimilarity && entropyStats && this.cachedBeta) {
            bmxSimilarity = this.calculateQueryDocSimilarity(query, docId);
            bmxSimilarityBoost = this.cachedBeta * bmxSimilarity * entropyStats.sumNormalizedEntropies;
            finalScore += bmxSimilarityBoost;
        }

        // Build explanation with BM𝒳 fields
        const explanation: ResoRankExplanation = {
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

        // Add BM𝒳-specific fields if enabled
        if (entropyStats) {
            explanation.bmxAvgEntropy = entropyStats.avgEntropy;
        }
        if (this.config.enableBMXSimilarity) {
            explanation.bmxEntropySimilarityBoost = bmxSimilarityBoost;
            explanation.bmxSimilarity = bmxSimilarity;
            explanation.bmxBeta = this.cachedBeta ?? undefined;
        }
        if (this.config.useAdaptiveAlpha) {
            explanation.bmxAlpha = this.cachedAlpha ?? undefined;
        }

        return explanation;
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
        accumulator: DocumentAccumulator,
        entropyStats?: QueryEntropyStats  // NEW: optional entropy stats
    ): { termScore: f32; breakdown: ResoRankTermBreakdown | null } {
        const tokenMeta = this.getTokenMetadata(term, docId);
        if (!tokenMeta) {
            return { termScore: 0, breakdown: null };
        }

        accumulator.termMasks.push(tokenMeta.segmentMask);
        const idf = this.getOrCalculateIdf(tokenMeta.corpusDocFrequency);
        accumulator.termIdfs.push(idf);

        // Get BM𝒳 parameters
        const avgEntropy = entropyStats?.avgEntropy ?? 0;
        const gamma = this.config.enableBMXEntropy ? (this.cachedGamma ?? 0) : 0;

        let aggregatedS = 0;
        const fieldContributions: ResoRankTermBreakdown['fieldContributions'] = [];

        // Aggregate across fields with BM𝒳 entropy adjustment
        for (const [fieldId, fieldData] of tokenMeta.fieldOccurrences) {
            const params = this.config.fieldParams.get(fieldId);
            if (!params) continue;

            const avgLen = this.corpusStats.averageFieldLengths.get(fieldId) || 1;

            // MODIFIED: Use normalizedTermFrequencyBMX with entropy
            const normalizedTf = normalizedTermFrequencyBMX(
                fieldData.tf,
                fieldData.fieldLength,
                avgLen,
                params.b,
                avgEntropy,   // NEW
                gamma         // NEW
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

        // MODIFIED: Use adaptive alpha if enabled
        const saturationParam = this.config.useAdaptiveAlpha
            ? (this.cachedAlpha ?? this.config.k1)
            : this.config.k1;

        const saturatedScore = idf * saturateBMX(aggregatedS, saturationParam);

        // Build breakdown with optional BM𝒳 entropy info
        const breakdown: ResoRankTermBreakdown = {
            term,
            idf,
            aggregatedS,
            saturatedScore,
            segmentMask: formatBinary(tokenMeta.segmentMask, this.config.maxSegments),
            fieldContributions,
        };

        // Add BM𝒳 entropy data if available
        if (entropyStats) {
            breakdown.entropy = entropyStats.normalizedEntropies.get(term);
            breakdown.rawEntropy = this.entropyCache.get(term);
        }

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

    /**
     * Enhanced search with Weighted Query Augmentation (WQA) support
     * Implements BM𝒳 Equation 9 with optimized candidate collection
     */
    search(
        query: string[],
        options: number | SearchOptions = {}
    ): Array<{ docId: K; score: f32; normalizedScore?: f32 }> {
        const startTime = this.metricsEnabled ? performance.now() : 0;
        let scoringTime = 0;
        let sortingTime = 0;

        // Handle legacy call with limit as number
        if (typeof options === 'number') {
            options = { limit: options };
        }

        const {
            limit = 10,
            augmentedQueries = [],
            normalize = false,
            strategy
        } = options;

        // Temporarily override strategy if specified
        const originalStrategy = this.proximityStrategy;
        if (strategy) {
            this.proximityStrategy = strategy;
        }

        try {
            // OPTIMIZATION: Collect all unique terms first (deduplication)
            const allTerms = new Set<string>(query);
            for (const aug of augmentedQueries) {
                for (const term of aug.query) {
                    allTerms.add(term);
                }
            }

            // Single-pass candidate collection across all terms
            const candidateDocs = new Set<K>();
            for (const term of allTerms) {
                const termDocs = this.tokenIndex.get(term);
                if (termDocs) {
                    for (const docId of termDocs.keys()) {
                        candidateDocs.add(docId);
                    }
                }
            }

            // Scoring phase (tracked)
            const scoringStart = this.metricsEnabled ? performance.now() : 0;
            const scores = new Map<K, f32>();

            // Score original query
            if (query.length > 0) {
                for (const docId of candidateDocs) {
                    const score = this.score(query, docId);
                    if (score > 0) {
                        scores.set(docId, score);
                    }
                }
            }

            // Add weighted scores from augmented queries (WQA - Equation 9)
            if (augmentedQueries.length > 0) {
                for (const aug of augmentedQueries) {
                    for (const docId of candidateDocs) {
                        const augScore = this.score(aug.query, docId);
                        if (augScore > 0) {
                            const currentScore = scores.get(docId) ?? 0;
                            scores.set(docId, currentScore + aug.weight * augScore);
                        }
                    }
                }
            }

            if (this.metricsEnabled) {
                scoringTime = performance.now() - scoringStart;
            }

            // Sorting phase (tracked)
            const sortingStart = this.metricsEnabled ? performance.now() : 0;

            // OPTIMIZATION: Use more efficient sorting for large result sets
            let results: Array<{ docId: K; score: f32 }>;
            if (scores.size > 1000) {
                // For large result sets, sort entries directly
                const entries = Array.from(scores.entries());
                entries.sort((a, b) => b[1] - a[1]);
                results = entries
                    .slice(0, limit)
                    .map(([docId, score]) => ({ docId, score }));
            } else {
                // Standard approach for smaller sets
                results = Array.from(scores.entries())
                    .map(([docId, score]) => ({ docId, score }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, limit);
            }

            if (this.metricsEnabled) {
                sortingTime = performance.now() - sortingStart;
            }

            // Normalization
            if (normalize) {
                const totalQueryLength = query.length +
                    augmentedQueries.reduce((sum, aug) => sum + aug.query.length, 0);

                results = results.map(result => ({
                    ...result,
                    normalizedScore: normalizeScore(
                        result.score,
                        totalQueryLength,
                        this.corpusStats.totalDocuments
                    )
                }));
            }

            // Capture metrics
            if (this.metricsEnabled) {
                this.lastQueryMetrics = {
                    queryLength: query.length,
                    candidateCount: candidateDocs.size,
                    scoredDocuments: scores.size,
                    totalTimeMs: performance.now() - startTime,
                    scoringTimeMs: scoringTime,
                    sortingTimeMs: sortingTime,
                    bmxEnabled: this.config.enableBMXEntropy || this.config.enableBMXSimilarity,
                    wqaEnabled: augmentedQueries.length > 0,
                    wqaQueryCount: augmentedQueries.length
                };
            }

            return results;
        } finally {
            // Restore original strategy
            this.proximityStrategy = originalStrategy;
        }
    }

    /**
     * Search with full explanations and optional WQA
     */
    searchWithExplanations(
        query: string[],
        options: number | SearchOptions = {}
    ): Array<{ docId: K; explanation: ResoRankExplanation }> {
        // Handle legacy call with limit as number
        if (typeof options === 'number') {
            options = { limit: options };
        }

        const {
            limit = 10,
            augmentedQueries = [],
            normalize = false,
            strategy
        } = options;

        // Temporarily override strategy if specified
        const originalStrategy = this.proximityStrategy;
        if (strategy) {
            this.proximityStrategy = strategy;
        }

        try {
            // Find all candidates (original + augmented queries)
            const candidateDocs = new Set<K>();
            for (const term of query) {
                const termDocs = this.tokenIndex.get(term);
                if (termDocs) {
                    for (const docId of termDocs.keys()) {
                        candidateDocs.add(docId);
                    }
                }
            }

            for (const aug of augmentedQueries) {
                for (const term of aug.query) {
                    const termDocs = this.tokenIndex.get(term);
                    if (termDocs) {
                        for (const docId of termDocs.keys()) {
                            candidateDocs.add(docId);
                        }
                    }
                }
            }

            // Score with explanations
            const results: Array<{ docId: K; explanation: ResoRankExplanation }> = [];

            for (const docId of candidateDocs) {
                const explanation = this.explainScore(query, docId);

                // Add WQA scores if provided
                if (augmentedQueries.length > 0) {
                    let wqaBoost = 0;
                    for (const aug of augmentedQueries) {
                        const augExplanation = this.explainScore(aug.query, docId);
                        wqaBoost += aug.weight * augExplanation.totalScore;
                    }
                    explanation.totalScore += wqaBoost;
                }

                // Add normalized score if requested
                if (normalize) {
                    const totalQueryLength = query.length +
                        augmentedQueries.reduce((sum, aug) => sum + aug.query.length, 0);
                    explanation.normalizedScore = normalizeScore(
                        explanation.totalScore,
                        totalQueryLength,
                        this.corpusStats.totalDocuments
                    );
                }

                if (explanation.totalScore > 0) {
                    results.push({ docId, explanation });
                }
            }

            return results
                .sort((a, b) => b.explanation.totalScore - a.explanation.totalScore)
                .slice(0, limit);
        } finally {
            this.proximityStrategy = originalStrategy;
        }
    }

    /**
     * Get corpus-wide statistics including entropy cache size
     */
    getStats(): {
        documentCount: usize;
        termCount: usize;
        idfCacheSize: usize;
        entropyCacheSize: usize; // NEW
    } {
        return {
            documentCount: this.documentIndex.size,
            termCount: this.tokenIndex.size,
            idfCacheSize: this.idfCache.size,
            entropyCacheSize: this.entropyCache.size,
        };
    }

    /**
     * Calculate query-level entropy statistics (BM𝒳 Equations 5-6)
     * Called at the start of each query if BM𝒳 features enabled
     */
    private calculateQueryEntropyStats(query: string[]): QueryEntropyStats {
        const normalizedEntropies = new Map<string, f32>();
        let maxRawEntropy = 0;

        // Step 1: Find max raw entropy across query terms
        for (const term of query) {
            const rawEntropy = this.entropyCache.get(term) ?? 0;
            maxRawEntropy = Math.max(maxRawEntropy, rawEntropy);
        }

        // Avoid division by zero
        const normalizationFactor = Math.max(maxRawEntropy, 1e-9);

        // Step 2: Normalize entropies
        let sumNormalizedE = 0;
        for (const term of query) {
            const rawEntropy = this.entropyCache.get(term) ?? 0;
            const normalizedE = rawEntropy / normalizationFactor;
            normalizedEntropies.set(term, normalizedE);
            sumNormalizedE += normalizedE;
        }

        // Step 3: Calculate average entropy (ℰ)
        const avgEntropy = query.length > 0 ? sumNormalizedE / query.length : 0;

        return {
            normalizedEntropies,
            avgEntropy,
            sumNormalizedEntropies: sumNormalizedE,
            maxRawEntropy,
        };
    }

    /**
     * Calculate query-document similarity S(Q,D) (BM𝒳 Equation 7)
     */
    private calculateQueryDocSimilarity(query: string[], docId: K): f32 {
        if (query.length === 0) return 0;

        let commonTerms = 0;
        for (const term of query) {
            if (this.tokenIndex.get(term)?.has(docId)) {
                commonTerms++;
            }
        }

        return commonTerms / query.length;
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

    // BM𝒳 Utilities
    sigmoid,
    calculateAdaptiveAlpha,
    calculateBeta,
    normalizeScore,
    normalizedTermFrequencyBMX,
    saturateBMX,
};
