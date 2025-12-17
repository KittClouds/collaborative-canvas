import {
    vectorSearchAgent,
    graphSearchAgent,
    ftsSearchAgent,
    temporalAgent,
    communityAgent,
    entityAgent,
    metaCoordinatorAgent,
} from './index';
import { QueryClassifier, QueryIntent, SearchStrategy } from '../queryClassifier';
import { ResultFusion, UnifiedResult } from '../resultFusion';

/**
 * Agent execution result
 */
interface AgentResult {
    agentName: string;
    results: any[];
    executionTime: number;
    error?: string;
}

/**
 * Execute Meta Search using Agent Network
 * Coordinates specialized agents based on query classification
 */
export async function executeAgentSearch(
    query: string,
    groupId: string = 'global'
): Promise<{
    query: string;
    strategy: SearchStrategy;
    agentResults: AgentResult[];
    fusedResults: UnifiedResult[];
    executionTimeMs: number;
}> {
    const startTime = Date.now();
    console.log(`🔍 Agent Network Search: "${query}"`);

    // Step 1: Classify query
    const classifier = new QueryClassifier();
    const strategy = classifier.classify(query);
    const entities = classifier.extractEntities(query);

    console.log(`📊 Intent: ${strategy.intent}`);
    console.log(`🎯 Modalities: ${strategy.modalities.map(m => m.type).join(', ')}`);
    console.log(`🔗 Entities: ${entities.join(', ') || 'none detected'}`);

    // Step 2: Map modalities to agents
    const agentPromises: Promise<AgentResult>[] = [];

    for (const modality of strategy.modalities) {
        switch (modality.type) {
            case 'vector':
                agentPromises.push(executeAgent(
                    vectorSearchAgent,
                    'VectorSearchSpecialist',
                    `Search for: "${query}". Max results: ${modality.params?.maxResults || 10}`
                ));
                break;

            case 'graph':
                if (entities.length > 0) {
                    agentPromises.push(executeAgent(
                        graphSearchAgent,
                        'GraphNavigationSpecialist',
                        `Explore connections for entity "${entities[0]}" within ${modality.params?.maxHops || 2} hops. Group: ${groupId}`
                    ));
                }
                break;

            case 'fts':
                agentPromises.push(executeAgent(
                    ftsSearchAgent,
                    'KeywordSearchSpecialist',
                    `Find exact matches for: "${query}". Max results: ${modality.params?.maxResults || 10}`
                ));
                break;

            case 'path':
                if (entities.length >= 2) {
                    agentPromises.push(executeAgent(
                        graphSearchAgent,
                        'GraphNavigationSpecialist',
                        `Find path between "${entities[0]}" and "${entities[1]}" in group: ${groupId}`
                    ));
                }
                break;

            case 'history':
                if (entities.length > 0) {
                    agentPromises.push(executeAgent(
                        temporalAgent,
                        'TemporalEvolutionSpecialist',
                        `Get historical evolution for entity: "${entities[0]}"`
                    ));
                }
                break;

            case 'community':
                agentPromises.push(executeAgent(
                    communityAgent,
                    'CommunityStructureSpecialist',
                    `Detect communities in group: ${groupId}`
                ));
                break;

            case 'entity':
                if (entities.length > 0) {
                    agentPromises.push(executeAgent(
                        entityAgent,
                        'EntityDetailsSpecialist',
                        `Get details for entity: "${entities[0]}"`
                    ));
                }
                break;
        }
    }

    // Step 3: Execute agents in parallel
    const agentResults = await Promise.all(agentPromises);
    console.log(`✅ ${agentResults.length} agents completed`);

    // Step 4: Normalize and fuse results
    const resultsByModality = new Map<string, UnifiedResult[]>();

    for (const result of agentResults) {
        if (result.results && result.results.length > 0) {
            const normalized = result.results.map((item: any, idx: number) => ({
                id: item.noteId || item.entityId || item.id || `${result.agentName}-${idx}`,
                type: inferResultType(item, result.agentName),
                title: item.title || item.noteTitle || item.name || 'Untitled',
                snippet: item.snippet || item.content || '',
                score: item.score || 1.0,
                sources: [],
                metadata: item,
            })) as UnifiedResult[];

            resultsByModality.set(result.agentName, normalized);
        }
    }

    // Step 5: Apply fusion strategy
    let fusedResults: UnifiedResult[];
    switch (strategy.fusionStrategy) {
        case 'weighted':
            fusedResults = ResultFusion.weightedFusion(resultsByModality);
            break;
        case 'ranked':
            fusedResults = ResultFusion.rankedFusion(resultsByModality);
            break;
        case 'intersect':
            fusedResults = ResultFusion.intersectFusion(resultsByModality);
            break;
        case 'union':
            fusedResults = ResultFusion.unionFusion(resultsByModality);
            break;
        default:
            fusedResults = ResultFusion.rankedFusion(resultsByModality);
    }

    // Step 6: Diversify
    fusedResults = ResultFusion.diversifyResults(fusedResults);

    const executionTimeMs = Date.now() - startTime;
    console.log(`⏱️ Total execution time: ${executionTimeMs}ms`);

    return {
        query,
        strategy,
        agentResults,
        fusedResults,
        executionTimeMs,
    };
}

/**
 * Execute a single agent
 */
async function executeAgent(
    agent: any,
    agentName: string,
    prompt: string
): Promise<AgentResult> {
    const startTime = Date.now();

    try {
        const response = await agent.generate(prompt);

        // Extract results from agent response
        let results: any[] = [];

        // Check tool results
        if (response.toolResults) {
            for (const toolResult of response.toolResults) {
                const data = toolResult.result || toolResult;
                if (data.success) {
                    if (data.results) results.push(...data.results);
                    if (data.neighbors) results.push(...data.neighbors);
                    if (data.entity) results.push(data.entity);
                    if (data.history) results.push(...data.history);
                    if (data.communities) results.push(...data.communities);
                    if (data.path) results.push(data.path);
                }
            }
        }

        return {
            agentName,
            results,
            executionTime: Date.now() - startTime,
        };
    } catch (error: any) {
        console.error(`Agent ${agentName} failed:`, error);
        return {
            agentName,
            results: [],
            executionTime: Date.now() - startTime,
            error: error.message,
        };
    }
}

/**
 * Infer result type based on content and agent
 */
function inferResultType(item: any, agentName: string): 'note' | 'entity' | 'relationship' | 'snapshot' {
    if (item.noteId) return 'note';
    if (item.entityId || agentName.includes('Entity')) return 'entity';
    if (agentName.includes('Graph') && item.path) return 'relationship';
    if (agentName.includes('Temporal')) return 'snapshot';
    return 'note';
}
