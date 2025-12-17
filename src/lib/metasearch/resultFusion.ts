import { z } from 'zod';
import { tool } from 'ai';

/**
 * Unified result structure across modalities
 */
export interface UnifiedResult {
    id: string;
    type: 'note' | 'entity' | 'relationship' | 'snapshot';
    title: string;
    snippet?: string;
    score: number;
    sources: {
        modality: string;
        originalScore: number;
        rank: number;
    }[];
    metadata?: Record<string, any>;
    combinedScore?: number;
}

/**
 * Fusion strategies for combining results
 */
export class ResultFusion {
    /**
     * Weighted fusion: Combine scores from multiple modalities with weights
     * Best for: Complementary modalities that each provide partial evidence
     */
    static weightedFusion(
        results: Map<string, UnifiedResult[]>,
        weights: Record<string, number> = {}
    ): UnifiedResult[] {
        const defaultWeights: Record<string, number> = {
            vector: 0.4,
            fts: 0.3,
            graph: 0.2,
            entity: 0.3,
            history: 0.2,
            path: 0.3,
            community: 0.1,
        };

        const finalWeights = { ...defaultWeights, ...weights };
        const resultMap = new Map<string, UnifiedResult>();

        // Normalize scores within each modality
        for (const [modality, items] of results.entries()) {
            if (items.length === 0) continue;

            const maxScore = Math.max(...items.map(r => r.score));
            const normalizedItems = items.map((item, idx) => ({
                ...item,
                score: maxScore > 0 ? item.score / maxScore : 1.0,
                sources: [{ modality, originalScore: item.score, rank: idx + 1 }],
            }));

            // Merge with existing results
            for (const item of normalizedItems) {
                const existing = resultMap.get(item.id);
                if (existing) {
                    // Combine scores with weight
                    existing.combinedScore = (existing.combinedScore || 0) +
                        item.score * (finalWeights[modality] || 0.1);
                    existing.sources.push(...item.sources);
                } else {
                    resultMap.set(item.id, {
                        ...item,
                        combinedScore: item.score * (finalWeights[modality] || 0.1),
                    });
                }
            }
        }

        // Sort by combined score
        return Array.from(resultMap.values())
            .sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0));
    }

    /**
     * Ranked fusion: Use reciprocal rank fusion (RRF)
     * Best for: When relative ranking matters more than absolute scores
     */
    static rankedFusion(
        results: Map<string, UnifiedResult[]>,
        k: number = 60 // RRF constant
    ): UnifiedResult[] {
        const resultMap = new Map<string, UnifiedResult>();

        for (const [modality, items] of results.entries()) {
            items.forEach((item, rank) => {
                const rrfScore = 1 / (k + rank + 1);
                const existing = resultMap.get(item.id);

                if (existing) {
                    existing.combinedScore = (existing.combinedScore || 0) + rrfScore;
                    existing.sources.push({ modality, originalScore: item.score, rank: rank + 1 });
                } else {
                    resultMap.set(item.id, {
                        ...item,
                        combinedScore: rrfScore,
                        sources: [{ modality, originalScore: item.score, rank: rank + 1 }],
                    });
                }
            });
        }

        return Array.from(resultMap.values())
            .sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0));
    }

    /**
     * Intersection fusion: Only return results found in multiple modalities
     * Best for: High-precision queries where agreement matters
     */
    static intersectFusion(
        results: Map<string, UnifiedResult[]>,
        minModalities: number = 2
    ): UnifiedResult[] {
        const resultMap = new Map<string, UnifiedResult>();

        for (const [modality, items] of results.entries()) {
            items.forEach((item, rank) => {
                const existing = resultMap.get(item.id);

                if (existing) {
                    existing.combinedScore = (existing.combinedScore || 0) + item.score;
                    existing.sources.push({ modality, originalScore: item.score, rank: rank + 1 });
                } else {
                    resultMap.set(item.id, {
                        ...item,
                        combinedScore: item.score,
                        sources: [{ modality, originalScore: item.score, rank: rank + 1 }],
                    });
                }
            });
        }

        // Filter to results found in at least minModalities
        return Array.from(resultMap.values())
            .filter(r => r.sources.length >= minModalities)
            .sort((a, b) => {
                // Sort by: 1) number of sources, 2) combined score
                if (b.sources.length !== a.sources.length) {
                    return b.sources.length - a.sources.length;
                }
                return (b.combinedScore || 0) - (a.combinedScore || 0);
            });
    }

    /**
     * Union fusion: Combine all results, deduplicating
     * Best for: Comprehensive recall, exploratory queries
     */
    static unionFusion(
        results: Map<string, UnifiedResult[]>
    ): UnifiedResult[] {
        const resultMap = new Map<string, UnifiedResult>();

        for (const [modality, items] of results.entries()) {
            items.forEach((item, rank) => {
                const existing = resultMap.get(item.id);

                if (existing) {
                    // Boost score if found in multiple places
                    existing.combinedScore = Math.max(
                        existing.combinedScore || 0,
                        item.score
                    ) * 1.2; // 20% boost for cross-modal presence
                    existing.sources.push({ modality, originalScore: item.score, rank: rank + 1 });
                } else {
                    resultMap.set(item.id, {
                        ...item,
                        combinedScore: item.score,
                        sources: [{ modality, originalScore: item.score, rank: rank + 1 }],
                    });
                }
            });
        }

        return Array.from(resultMap.values())
            .sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0));
    }

    /**
     * Context-aware boosting: Boost results based on graph centrality & recency
     */
    static applyContextBoosts(
        results: UnifiedResult[],
        boosts: {
            graphCentrality?: Map<string, number>; // Entity ID -> centrality score
            recencyScores?: Map<string, number>;   // Entity ID -> recency (0-1)
            userPreferences?: Map<string, number>; // Entity ID -> preference weight
        } = {}
    ): UnifiedResult[] {
        return results.map(result => {
            let boostFactor = 1.0;

            // Apply graph centrality boost (important entities get boost)
            if (boosts.graphCentrality?.has(result.id)) {
                const centrality = boosts.graphCentrality.get(result.id)!;
                boostFactor *= (1 + centrality * 0.3); // Up to 30% boost
            }

            // Apply recency boost (newer content gets boost)
            if (boosts.recencyScores?.has(result.id)) {
                const recency = boosts.recencyScores.get(result.id)!;
                boostFactor *= (1 + recency * 0.2); // Up to 20% boost
            }

            // Apply user preference boost
            if (boosts.userPreferences?.has(result.id)) {
                const preference = boosts.userPreferences.get(result.id)!;
                boostFactor *= (1 + preference * 0.5); // Up to 50% boost
            }

            return {
                ...result,
                combinedScore: (result.combinedScore || result.score) * boostFactor,
            };
        }).sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0));
    }

    /**
     * Diversify results: Reduce redundancy by penalizing similar results
     */
    static diversifyResults(
        results: UnifiedResult[],
        similarityThreshold: number = 0.8,
        maxSimilarResults: number = 2
    ): UnifiedResult[] {
        const diversified: UnifiedResult[] = [];
        const titleClusters = new Map<string, number>();

        for (const result of results) {
            const normalizedTitle = result.title.toLowerCase().trim();
            const clusterCount = titleClusters.get(normalizedTitle) || 0;

            if (clusterCount < maxSimilarResults) {
                diversified.push(result);
                titleClusters.set(normalizedTitle, clusterCount + 1);
            }
            // Skip if we already have enough similar results
        }

        return diversified;
    }
}

/**
 * Mastra Tool: Fusion Strategy Executor
 */
export const fusionTool = tool({
    description: 'Combine results from multiple search modalities using specified fusion strategy',
    parameters: z.object({
        results: z.record(z.array(z.any())).describe('Results from each modality, keyed by modality name'),
        strategy: z.enum(['weighted', 'ranked', 'intersect', 'union']).describe('Fusion strategy to apply'),
        weights: z.record(z.number()).optional().describe('Optional weights for weighted fusion'),
        diversify: z.boolean().optional().describe('Whether to diversify results'),
    }),
    execute: async ({ results, strategy, weights, diversify }) => {
        try {
            // Convert results to UnifiedResult format
            const normalizedResults = new Map<string, UnifiedResult[]>();

            for (const [modality, items] of Object.entries(results)) {
                const unified = (items as any[]).map((item, idx) => ({
                    id: item.noteId || item.entityId || item.id || `${modality}-${idx}`,
                    type: item.type || 'note',
                    title: item.title || item.noteTitle || item.name || 'Untitled',
                    snippet: item.snippet || item.content || '',
                    score: item.score || 1.0,
                    sources: [],
                    metadata: item.metadata || {},
                })) as UnifiedResult[];

                normalizedResults.set(modality, unified);
            }

            // Apply fusion strategy
            let fused: UnifiedResult[];
            switch (strategy) {
                case 'weighted':
                    fused = ResultFusion.weightedFusion(normalizedResults, weights);
                    break;
                case 'ranked':
                    fused = ResultFusion.rankedFusion(normalizedResults);
                    break;
                case 'intersect':
                    fused = ResultFusion.intersectFusion(normalizedResults);
                    break;
                case 'union':
                    fused = ResultFusion.unionFusion(normalizedResults);
                    break;
                default:
                    fused = ResultFusion.rankedFusion(normalizedResults);
            }

            // Optionally diversify
            if (diversify) {
                fused = ResultFusion.diversifyResults(fused);
            }

            return {
                success: true,
                results: fused.slice(0, 20), // Top 20 results
                totalBeforeFusion: Array.from(normalizedResults.values())
                    .reduce((sum, arr) => sum + arr.length, 0),
                totalAfterFusion: fused.length,
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },
} as any);
