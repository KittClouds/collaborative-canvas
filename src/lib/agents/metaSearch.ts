import { streamText, generateText, CoreMessage } from 'ai';
import { google } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { tools, analyzeQueryTool, rerankResultsTool, shouldExpandGraphTool } from './tools';
import { ModelProvider } from './mastra.config';
import { SettingsManager } from '@/lib/settings/SettingsManager';

export type { ModelProvider };

export interface MetaSearchOptions {
    query: string;
    groupId?: string;
    modelProvider?: ModelProvider;
    modelName?: string;
    maxResults?: number;
    enableStreaming?: boolean;
    context?: CoreMessage[];
}

export interface MetaSearchResult {
    answer: string;
    sources: Array<{
        noteId?: string;
        entityId?: string;
        title?: string;
        snippet?: string;
        score?: number;
        sources?: string[];
    }>;
    metadata: {
        queryType: string;
        strategiesUsed: string[];
        totalResultsConsidered: number;
        executionTimeMs: number;
    };
}

// MetaSearch Agent System Instructions
const META_SEARCH_INSTRUCTIONS = `You are an intelligent MetaSearch orchestrator for a knowledge graph system.

Your role is to:
1. **Analyze user queries** to understand intent (relationship, temporal, semantic, exact lookup, etc.)
2. **Route to appropriate search modalities** (vector, graph, FTS, temporal, community)
3. **Combine results** from multiple sources intelligently using the reranking tool
4. **Present coherent, well-structured answers** with proper citations

## Search Modalities Available

| Tool | Use When |
|------|----------|
| **searchVector** | Semantic/conceptual queries ("similar to", "themes about", "meaning of") |
| **searchFts** | Exact name/keyword lookups ("who is Alice", "notes about React") |
| **searchGraph** | Relationship exploration ("connected to", "related characters") |
| **findPath** | Relationship paths between two entities ("how are X and Y connected") |
| **getHistory** | Evolution tracking ("how has X changed over time") |
| **analyzeCommunities** | Clustering ("groups of related entities", "categories") |
| **getEntity** | Full entity metadata lookup by name |

## Orchestration Strategy

1. **Start with analyzeQuery** to classify the query intent
2. Based on the analysis, execute the primary search strategy
3. Use **shouldExpandGraph** to decide if you need more context
4. If multi-modal search is recommended, run additional searches
5. Use **rerankResults** to merge and deduplicate results
6. Synthesize the final answer

## Strategy Guidelines

- **Exact lookups** (who is X, what is Y): searchFts → getEntity
- **Relationship queries** (connected, related, between): findPath → searchGraph
- **Conceptual queries** (themes, similar, about): searchVector → expand with searchGraph
- **Temporal queries** (history, evolution, over time): getHistory → searchVector for context
- **Community queries** (groups, clusters): analyzeCommunities
- **Exploratory queries** (tell me about, everything): searchVector → searchFts → searchGraph

## Citation Format

Always cite sources using: [Note Title](noteId:UUID) or [Entity Name](entity:ID)

## Important

- Be concise but thorough
- Explain your search strategy briefly when relevant
- If no results are found, suggest alternative search approaches
- Prioritize quality over quantity in your final answer`;

/**
 * Get OpenRouter client with API key from settings
 */
function getOpenRouterClient() {
    const apiKey = SettingsManager.getApiKey('openrouter');
    return createOpenRouter({
        apiKey: apiKey || import.meta.env.VITE_OPENROUTER_API_KEY || '',
    });
}

/**
 * Get model instance for provider
 */
function getModel(modelProvider: ModelProvider, modelName: string) {
    switch (modelProvider) {
        case 'openrouter':
            const openrouter = getOpenRouterClient();
            return openrouter(modelName);
        case 'google':
        default:
            return google(modelName);
    }
}

/**
 * MetaSearch - Intelligent multi-modal search orchestration
 * 
 * Routes queries to the most appropriate search modalities based on intent,
 * then combines and re-ranks results for comprehensive answers.
 */
export async function metaSearch(options: MetaSearchOptions): Promise<MetaSearchResult> {
    const startTime = Date.now();
    const {
        query,
        groupId = 'global',
        modelProvider = 'google',
        modelName = 'gemini-2.5-flash',
        maxResults = 10,
        context = [],
    } = options;

    const model = getModel(modelProvider, modelName);

    try {
        // Step 1: Analyze query to determine strategy
        const analysisResult = await analyzeQueryTool.execute!({ query }, {} as any);
        const queryAnalysis = analysisResult as {
            strategies: Array<{ type: string; priority: number; reason: string }>;
            primaryStrategy: string;
            needsMultiModal: boolean;
            queryType: string;
        };

        // Build the message sequence
        const messages: CoreMessage[] = [
            ...context,
            {
                role: 'user',
                content: `I need you to search and answer this query: "${query}"

Query Analysis:
- Type: ${queryAnalysis.queryType}
- Primary Strategy: ${queryAnalysis.primaryStrategy}
- Multi-modal recommended: ${queryAnalysis.needsMultiModal}
- Strategies to consider: ${queryAnalysis.strategies.map(s => `${s.type} (${s.reason})`).join(', ')}

Please execute the appropriate searches using the tools, combine the results, and provide a comprehensive answer.
Group/Scope ID for graph operations: ${groupId}
Maximum results per search: ${maxResults}`
            }
        ];

        // Step 2: Let the agent execute the search with full tool access
        const result = await generateText({
            model,
            system: META_SEARCH_INSTRUCTIONS,
            messages,
            tools: tools as any,
            maxToolRoundtrips: 8, // Allow multi-step tool execution
            experimental_telemetry: { isEnabled: false },
        } as any);

        // Extract sources from tool calls
        const sources: MetaSearchResult['sources'] = [];
        const strategiesUsed = new Set<string>();

        // Process tool results to extract sources
        for (const step of result.steps || []) {
            for (const toolResult of step.toolResults || []) {
                // Access the result - structure varies by AI SDK version
                const toolResultData = (toolResult as any).result ?? toolResult;
                const toolName = (toolResult as any).toolName || '';
                if (toolResultData?.success) {
                    // Track which strategies were used
                    if (toolName.includes('Vector')) strategiesUsed.add('vector');
                    if (toolName.includes('Fts')) strategiesUsed.add('fts');
                    if (toolName.includes('Graph')) strategiesUsed.add('graph');
                    if (toolName.includes('Path')) strategiesUsed.add('path');
                    if (toolName.includes('History')) strategiesUsed.add('temporal');
                    if (toolName.includes('Communities')) strategiesUsed.add('community');
                    if (toolName.includes('Entity')) strategiesUsed.add('entity');

                    // Extract sources from results
                    if (toolResultData.results) {
                        for (const r of toolResultData.results) {
                            if (!sources.some(s => s.noteId === r.noteId || s.entityId === r.entityId)) {
                                sources.push({
                                    noteId: r.noteId,
                                    entityId: r.entityId,
                                    title: r.title || r.noteTitle || r.name,
                                    snippet: r.snippet,
                                    score: r.score || r.combinedScore,
                                    sources: r.sources,
                                });
                            }
                        }
                    }
                    if (toolResultData.neighbors) {
                        for (const n of toolResultData.neighbors) {
                            if (!sources.some(s => s.entityId === n.id)) {
                                sources.push({
                                    entityId: n.id,
                                    title: n.name,
                                });
                            }
                        }
                    }
                    if (toolResultData.entity) {
                        sources.push({
                            entityId: toolResultData.entity.id,
                            title: toolResultData.entity.name,
                        });
                    }
                }
            }
        }

        return {
            answer: result.text,
            sources: sources.slice(0, maxResults),
            metadata: {
                queryType: queryAnalysis.queryType,
                strategiesUsed: Array.from(strategiesUsed),
                totalResultsConsidered: sources.length,
                executionTimeMs: Date.now() - startTime,
            }
        };

    } catch (error: any) {
        console.error('MetaSearch error:', error);
        throw new Error(`MetaSearch failed: ${error.message}`);
    }
}

/**
 * Stream a MetaSearch response - useful for real-time UI updates
 */
export async function metaSearchStream(options: MetaSearchOptions) {
    const {
        query,
        groupId = 'global',
        modelProvider = 'google',
        modelName = 'gemini-2.5-flash',
        maxResults = 10,
        context = [],
    } = options;

    const model = getModel(modelProvider, modelName);

    // Pre-analyze query
    const analysisResult = await analyzeQueryTool.execute!({ query }, {} as any);
    const queryAnalysis = analysisResult as {
        queryType: string;
        primaryStrategy: string;
        needsMultiModal: boolean;
        strategies: Array<{ type: string; reason: string }>;
    };

    const messages: CoreMessage[] = [
        ...context,
        {
            role: 'user',
            content: `Search and answer: "${query}"

Query Analysis: ${queryAnalysis.queryType} (${queryAnalysis.primaryStrategy})
Strategies: ${queryAnalysis.strategies.map(s => s.type).join(', ')}
Group ID: ${groupId}, Max Results: ${maxResults}`
        }
    ];

    return streamText({
        model,
        system: META_SEARCH_INSTRUCTIONS,
        messages,
        tools: tools as any,
        maxToolRoundtrips: 8,
        experimental_telemetry: { isEnabled: false },
    } as any);
}

/**
 * Quick search - simplified interface for common use cases
 */
export async function quickSearch(query: string, options?: Partial<MetaSearchOptions>): Promise<string> {
    const result = await metaSearch({
        query,
        ...options,
    });
    return result.answer;
}

// Export types for external use
export type { CoreMessage };
