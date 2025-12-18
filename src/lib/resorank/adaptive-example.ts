/**
 * Example usage of the new AdaptiveResoRank system
 * This demonstrates how the intelligent auto-configuration works
 */

import {
    ResoRankScorer,
    ResoRankConfig,
    ProximityStrategy,
    RESORANK_DEFAULT_CONFIG,
    CorpusStatistics,
    DocumentMetadata,
    TokenMetadata,
    // NEW: Adaptive types
    CorpusProfile,
    AdaptiveConfig,
    QueryCharacteristics,
    PerformanceMetrics,
    CORPUS_SIZE_THRESHOLDS,
    CAPACITY_ESTIMATES,
} from './index';

// Mock types for demonstration
type DocId = string;

// =============================================================================
// Basic Usage Example
// =============================================================================

export function demonstrateBasicUsage() {
    console.log('🧠 AdaptiveResoRank - Basic Usage Example\n');

    // Example corpus statistics
    const corpusStats: CorpusStatistics = {
        totalDocuments: 500, // This will be classified as "small" corpus
        averageFieldLengths: new Map([
            [0, 150], // Title field - average 150 tokens
            [1, 2000], // Body field - average 2000 tokens
        ]),
        averageDocumentLength: 2150,
    };

    // Example: Create basic ResoRank (existing functionality)
    const basicScorer = new ResoRankScorer<DocId>(
        RESORANK_DEFAULT_CONFIG,
        corpusStats,
        ProximityStrategy.Pairwise
    );

    console.log('✅ Basic ResoRank created with existing API');
    console.log(`   Strategy: ${ProximityStrategy.Pairwise}`);
    console.log(`   Documents: ${corpusStats.totalDocuments}\n`);

    // Example: Intelligent configuration based on corpus size
    const adaptiveConfig = generateAdaptiveConfig(corpusStats.totalDocuments);
    console.log('🎯 Adaptive Configuration Generated:');
    console.log(`   Strategy: ${adaptiveConfig.strategy}`);
    console.log(`   Cache Warming: ${adaptiveConfig.enableCacheWarming}`);
    console.log(`   Batch Optimization: ${adaptiveConfig.enableBatchOptimization}`);
    console.log(`   Progressive Enhancement: ${adaptiveConfig.enableProgressiveEnhancement}`);
    console.log(`   Sharding Required: ${adaptiveConfig.shardingRequired}`);
    if (adaptiveConfig.recommendedShards) {
        console.log(`   Recommended Shards: ${adaptiveConfig.recommendedShards}\n`);
    }

    return { basicScorer, adaptiveConfig };
}

// =============================================================================
// Adaptive Configuration Logic
// =============================================================================

export function generateAdaptiveConfig(documentCount: number): AdaptiveConfig {
    // Determine corpus size category
    let size: CorpusProfile['size'] = 'tiny';
    if (documentCount > CORPUS_SIZE_THRESHOLDS.large) size = 'xlarge';
    else if (documentCount > CORPUS_SIZE_THRESHOLDS.medium) size = 'large';
    else if (documentCount > CORPUS_SIZE_THRESHOLDS.small) size = 'medium';
    else if (documentCount > CORPUS_SIZE_THRESHOLDS.tiny) size = 'small';

    // Base configuration
    const config: ResoRankConfig = { ...RESORANK_DEFAULT_CONFIG };
    let strategy: ProximityStrategy;
    let enableCacheWarming = false;
    let enableBatchOptimization = false;
    let enableProgressiveEnhancement = false;
    let shardingRequired = false;
    let recommendedShards: number | undefined;

    // Apply size-based optimizations
    switch (size) {
        case 'tiny':
            strategy = ProximityStrategy.Pairwise;
            config.maxSegments = 8;  // Reduce overhead
            config.proximityAlpha = 0.3;
            enableBatchOptimization = true;
            break;

        case 'small':
            strategy = ProximityStrategy.Pairwise;
            config.maxSegments = 12;
            config.proximityAlpha = 0.4;
            enableCacheWarming = true;
            enableBatchOptimization = true;
            break;

        case 'medium':
            strategy = ProximityStrategy.IdfWeighted;
            config.maxSegments = 16;
            config.proximityAlpha = 0.5;
            enableCacheWarming = true;
            enableBatchOptimization = true;
            enableProgressiveEnhancement = true;
            break;

        case 'large':
            strategy = ProximityStrategy.IdfWeighted;
            config.maxSegments = 16;
            config.proximityAlpha = 0.5;
            config.idfProximityScale = 6.0;
            enableCacheWarming = true;
            enableBatchOptimization = true;

            if (documentCount > 50_000) {
                shardingRequired = true;
                recommendedShards = Math.ceil(documentCount / 25_000);
            }
            break;

        case 'xlarge':
            strategy = ProximityStrategy.Pairwise;  // Faster for distributed
            config.maxSegments = 12;
            config.proximityAlpha = 0.4;
            enableCacheWarming = true;
            enableBatchOptimization = true;
            shardingRequired = true;
            recommendedShards = Math.ceil(documentCount / 25_000);
            break;
    }

    return {
        strategy,
        config,
        enableCacheWarming,
        enableBatchOptimization,
        enableProgressiveEnhancement,
        shardingRequired,
        recommendedShards,
    };
}

// =============================================================================
// Performance Monitoring Example
// =============================================================================

export function demonstratePerformanceMonitoring() {
    console.log('\n📊 Performance Monitoring Example\n');

    // Example performance metrics
    const performanceMetrics: PerformanceMetrics = {
        currentQPS: 850,
        p50LatencyMs: 0.8,
        p99LatencyMs: 2.4,
        cacheHitRate: 0.94,
        memoryUsageMB: 156,
        indexingRateDocsPerSec: 1250,
    };

    console.log('Current Performance Metrics:');
    console.log(`   QPS: ${performanceMetrics.currentQPS}`);
    console.log(`   P50 Latency: ${performanceMetrics.p50LatencyMs}ms`);
    console.log(`   P99 Latency: ${performanceMetrics.p99LatencyMs}ms`);
    console.log(`   Cache Hit Rate: ${(performanceMetrics.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`   Memory Usage: ${performanceMetrics.memoryUsageMB}MB`);
    console.log(`   Indexing Rate: ${performanceMetrics.indexingRateDocsPerSec} docs/sec`);

    // Example capacity estimates for different corpus sizes
    console.log('\n📈 Capacity Estimates by Corpus Size:');
    Object.entries(CAPACITY_ESTIMATES).forEach(([size, estimates]) => {
        console.log(`   ${size.toUpperCase()}: ${estimates.maxQPS} QPS, ${estimates.p99LatencyMs}ms P99`);
    });

    // Health check example
    const healthStatus = performHealthCheck(performanceMetrics, 'small');
    console.log('\n🏥 Health Status:', healthStatus.status.toUpperCase());
    if (healthStatus.issues.length > 0) {
        console.log('Issues:');
        healthStatus.issues.forEach(issue => console.log(`   ⚠️ ${issue}`));
    }
    if (healthStatus.recommendations.length > 0) {
        console.log('Recommendations:');
        healthStatus.recommendations.forEach(rec => console.log(`   💡 ${rec}`));
    }
}

function performHealthCheck(
    performance: PerformanceMetrics,
    corpusSize: keyof typeof CAPACITY_ESTIMATES
): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
} {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const capacity = CAPACITY_ESTIMATES[corpusSize];

    // Check latency
    if (performance.p99LatencyMs > capacity.p99LatencyMs * 1.5) {
        issues.push(`P99 latency (${performance.p99LatencyMs.toFixed(2)}ms) exceeds expected (${capacity.p99LatencyMs}ms)`);
        recommendations.push('Consider upgrading to larger instance or enabling sharding');
    }

    // Check cache hit rate
    if (performance.cacheHitRate < 0.90) {
        issues.push(`Cache hit rate (${(performance.cacheHitRate * 100).toFixed(1)}%) below 90%`);
        recommendations.push('Warm IDF cache more frequently or increase cache size');
    }

    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (issues.length > 0) status = 'warning';
    if (issues.length > 2 || performance.p99LatencyMs > capacity.p99LatencyMs * 2) {
        status = 'critical';
    }

    return { status, issues, recommendations };
}

// =============================================================================
// Query Routing Example
// =============================================================================

export function demonstrateQueryRouting() {
    console.log('\n🎯 Query Routing Example\n');

    // Example query types and their optimal routing
    const queries = [
        { terms: ['machine'], description: 'Single term query' },
        { terms: ['machine', 'learning'], description: 'Multi-term query' },
        { terms: ['machine', 'learning', 'algorithms'], description: 'Complex query' },
        { terms: ['machine learning'], description: 'Phrase query' },
    ];

    queries.forEach(query => {
        const routing = determineOptimalRouting(query.terms);
        console.log(`${query.description}:`);
        console.log(`   Terms: [${query.terms.join(', ')}]`);
        console.log(`   Strategy: ${routing.strategy}`);
        console.log(`   Expected Overhead: ${routing.overhead}\n`);
    });
}

function determineOptimalRouting(query: string[]): {
    strategy: ProximityStrategy;
    overhead: 'minimal' | 'low' | 'moderate' | 'high';
} {
    // Single term queries are fastest
    if (query.length === 1) {
        return { strategy: ProximityStrategy.Pairwise, overhead: 'minimal' };
    }

    // Phrase queries benefit from proximity
    if (query.length >= 2 && query.length <= 5) {
        return { strategy: ProximityStrategy.IdfWeighted, overhead: 'moderate' };
    }

    // Complex multi-term queries
    return { strategy: ProximityStrategy.IdfWeighted, overhead: 'high' };
}

// =============================================================================
// Progressive Enhancement Example
// =============================================================================

export async function demonstrateProgressiveEnhancement() {
    console.log('\n⚡ Progressive Enhancement Example\n');

    console.log('Traditional search flow:');
    console.log('1. 🔍 Perform expensive search');
    console.log('2. ⏳ Wait for complete results');
    console.log('3. 📊 Return final rankings');
    console.log('   Total time: ~100-200ms\n');

    console.log('Progressive enhancement flow:');
    console.log('1. 🚀 Fast approximate search (Pairwise) - ~20-50ms');
    console.log('   → Return initial results immediately');
    console.log('2. 🔄 Background refinement (IdfWeighted) - ~50-150ms');
    console.log('   → Update with precise rankings if significantly different\n');

    // Simulate progressive results
    const fastResults = [
        { docId: 'doc1', score: 0.85 },
        { docId: 'doc3', score: 0.82 },
        { docId: 'doc5', score: 0.78 },
    ];

    const preciseResults = [
        { docId: 'doc3', score: 0.91 },
        { docId: 'doc1', score: 0.88 },
        { docId: 'doc7', score: 0.85 },
    ];

    console.log('📊 Results comparison:');
    console.log('Fast results:', fastResults.map(r => r.docId).join(', '));
    console.log('Precise results:', preciseResults.map(r => r.docId).join(', '));
    console.log('Ranking changed:', fastResults[0].docId !== preciseResults[0].docId ? 'Yes' : 'No');
}

// =============================================================================
// Main Demo
// =============================================================================

export async function runAdaptiveResoRankDemo() {
    console.log('🎯 Adaptive ResoRank System Demo');
    console.log('=================================\n');

    demonstrateBasicUsage();
    demonstratePerformanceMonitoring();
    demonstrateQueryRouting();
    await demonstrateProgressiveEnhancement();

    console.log('\n✨ Key Benefits of Adaptive System:');
    console.log('• Zero configuration - works out of the box');
    console.log('• Automatic optimization based on corpus size');
    console.log('• Intelligent query routing for best performance');
    console.log('• Real-time performance monitoring and health checks');
    console.log('• Progressive enhancement for better UX');
    console.log('• Automatic sharding recommendations for large corpora\n');
}

// Run the demo if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
    runAdaptiveResoRankDemo().catch(console.error);
}
