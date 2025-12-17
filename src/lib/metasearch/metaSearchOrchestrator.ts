import { QueryClassifier, SearchStrategy } from './queryClassifier';
import { ResultFusion, UnifiedResult } from './resultFusion';
import { tools } from '@/lib/agents/tools';

/**
 * Meta Search Orchestrator - Coordinates multi-modal search
 */
export class MetaSearchOrchestrator {
    private classifier: QueryClassifier;

    constructor() {
        this.classifier = new QueryClassifier();
    }

    /**
     * Execute search across multiple modalities
     */
    async executeMultiModalSearch(
        query: string,
        groupId: string = 'global'
    ): Promise<{
        results: UnifiedResult[];
        strategy: SearchStrategy;
        executionPlan: {
            modalitiesUsed: string[];
            resultCounts: Record<string, number>;
        };
    }> {
        // Step 1: Classify query
        const strategy = this.classifier.classify(query);
        console.log(`🔍 Query classified as: ${strategy.intent}`);
        console.log(`📊 Fusion strategy: ${strategy.fusionStrategy}`);
        console.log(`🎯 Confidence: ${strategy.confidence}`);

        // Step 2: Extract entities for targeted queries
        const entities = this.classifier.extractEntities(query);

        // Step 3: Execute searches in parallel based on strategy
        const searchPromises = new Map<string, Promise<any>>();

        for (const modality of strategy.modalities) {
            switch (modality.type) {
                case 'vector':
                    searchPromises.set('vector', this.executeVectorSearch(query, modality.params));
                    break;
                case 'fts':
                    searchPromises.set('fts', this.executeFtsSearch(query, modality.params));
                    break;
                case 'graph':
                    // Need entity ID first
                    if (entities.length > 0) {
                        searchPromises.set('graph', this.executeGraphSearch(entities[0], modality.params, groupId));
                    }
                    break;
                case 'path':
                    if (entities.length >= 2) {
                        searchPromises.set('path', this.executePathSearch(entities[0], entities[1], groupId));
                    }
                    break;
                case 'history':
                    if (entities.length > 0) {
                        searchPromises.set('history', this.executeHistorySearch(entities[0]));
                    }
                    break;
                case 'entity':
                    if (entities.length > 0) {
                        searchPromises.set('entity', this.executeEntitySearch(entities[0]));
                    }
                    break;
                case 'community':
                    searchPromises.set('community', this.executeCommunitySearch(groupId));
                    break;
            }
        }

        // Step 4: Await all searches
        const searchResults = new Map<string, any[]>();
        for (const [key, promise] of searchPromises.entries()) {
            try {
                const result = await promise;
                searchResults.set(key, result);
            } catch (error) {
                console.error(`Error in ${key} search:`, error);
                searchResults.set(key, []);
            }
        }

        // Step 5: Normalize results to UnifiedResult format
        const normalizedResults = new Map<string, UnifiedResult[]>();
        for (const [modality, results] of searchResults.entries()) {
            normalizedResults.set(modality, this.normalizeResults(results, modality));
        }

        // Step 6: Apply fusion strategy
        let fusedResults: UnifiedResult[];
        switch (strategy.fusionStrategy) {
            case 'weighted':
                fusedResults = ResultFusion.weightedFusion(normalizedResults);
                break;
            case 'ranked':
                fusedResults = ResultFusion.rankedFusion(normalizedResults);
                break;
            case 'intersect':
                fusedResults = ResultFusion.intersectFusion(normalizedResults);
                break;
            case 'union':
                fusedResults = ResultFusion.unionFusion(normalizedResults);
                break;
            default:
                fusedResults = ResultFusion.rankedFusion(normalizedResults);
        }

        // Step 7: Diversify results
        fusedResults = ResultFusion.diversifyResults(fusedResults);

        return {
            results: fusedResults,
            strategy,
            executionPlan: {
                modalitiesUsed: Array.from(searchResults.keys()),
                resultCounts: Object.fromEntries(
                    Array.from(searchResults.entries()).map(([k, v]) => [k, v.length])
                ),
            },
        };
    }

    // Helper methods for each search type
    private async executeVectorSearch(query: string, params: any): Promise<any[]> {
        const result = await tools.searchVector.execute!({
            query,
            maxResults: params?.maxResults || 10
        }, {} as any);
        return (result as any).success ? (result as any).results : [];
    }

    private async executeFtsSearch(query: string, params: any): Promise<any[]> {
        const result = await tools.searchFts.execute!({
            query,
            maxResults: params?.maxResults || 10
        }, {} as any);
        return (result as any).success ? (result as any).results : [];
    }

    private async executeGraphSearch(entityId: string, params: any, groupId: string): Promise<any[]> {
        const result = await tools.searchGraph.execute!({
            entityId,
            maxHops: params?.maxHops || 2,
            groupId,
        }, {} as any);
        return (result as any).success ? (result as any).neighbors : [];
    }

    private async executePathSearch(fromId: string, toId: string, groupId: string): Promise<any[]> {
        const result = await tools.findPath.execute!({
            fromEntityId: fromId,
            toEntityId: toId,
            groupId,
        }, {} as any);
        return (result as any).success && (result as any).path ? [(result as any).path] : [];
    }

    private async executeHistorySearch(entityId: string): Promise<any[]> {
        const result = await tools.getHistory.execute!({ entityId }, {} as any);
        return (result as any).success ? (result as any).history : [];
    }

    private async executeEntitySearch(name: string): Promise<any[]> {
        const result = await tools.getEntity.execute!({ name }, {} as any);
        return (result as any).success ? [(result as any).entity] : [];
    }

    private async executeCommunitySearch(groupId: string): Promise<any[]> {
        const result = await tools.analyzeCommunities.execute!({ groupId }, {} as any);
        return (result as any).success ? (result as any).communities : [];
    }

    private normalizeResults(results: any[], modality: string): UnifiedResult[] {
        return results.map((item, idx) => ({
            id: item.noteId || item.entityId || item.id || `${modality}-${idx}`,
            type: this.inferType(item, modality),
            title: item.title || item.noteTitle || item.name || 'Untitled',
            snippet: item.snippet || item.content || '',
            score: item.score || 1.0,
            sources: [],
            metadata: item.metadata || item,
        }));
    }

    private inferType(item: any, modality: string): 'note' | 'entity' | 'relationship' | 'snapshot' {
        if (item.noteId) return 'note';
        if (item.entityId || modality === 'entity') return 'entity';
        if (modality === 'path') return 'relationship';
        if (modality === 'history') return 'snapshot';
        return 'note';
    }
}

// Export singleton instance
export const metaSearchOrchestrator = new MetaSearchOrchestrator();
