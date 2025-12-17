// import { Mastra, Agent } from '@mastra/core';
// import { createOpenAI } from '@ai-sdk/openai';
// import { createAnthropic } from '@ai-sdk/anthropic';
// import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { CozoEntity, CozoEntityEdge } from '../types';
import { 
    type LLMExtractionConfig, 
    getDefaultModel, 
    getSupportedModels, 
    estimateTokenCost 
} from './extractionConfig';

// Re-export for compatibility
export { getDefaultModel, getSupportedModels, estimateTokenCost, type LLMExtractionConfig };

// ============================================
// SCHEMAS (Zod for structured outputs)
// ============================================

const EntitySchema = z.object({
    name: z.string().describe('Entity name (e.g., "Jon Snow")'),
    type: z.enum([
        'CHARACTER', 'LOCATION', 'NPC', 'ITEM', 'FACTION',
        'SCENE', 'EVENT', 'CONCEPT', 'ORGANIZATION', 'PERSON',
    ]).describe('Entity type category'),
    subtype: z.string().optional().describe('More specific type (e.g., PROTAGONIST, ANTAGONIST)'),
    summary: z.string().optional().describe('Brief 1-2 sentence description'),
    confidence: z.number().min(0).max(1).default(0.8),
    aliases: z.array(z.string()).default([]).describe('Alternative names'),
    attributes: z.record(z.any()).optional().describe('Additional metadata (JSON object)'),
});

const RelationshipSchema = z.object({
    source_entity: z.string().describe('Name of source entity (must match entity.name)'),
    target_entity: z.string().describe('Name of target entity (must match entity.name)'),
    fact: z.string().describe('Description of relationship'),
    edge_type: z.string().describe('Relationship type (e.g., WORKS_AT, ALLY_OF, LOCATED_IN)'),
    confidence: z.number().min(0).max(1).default(0.8),
});

const ExtractionOutputSchema = z.object({
    entities: z.array(EntitySchema).describe('List of entities found in text'),
    relationships: z.array(RelationshipSchema).describe('List of relationships between entities'),
    confidence: z.number().min(0).max(1).describe('Overall extraction confidence'),
});

export interface LLMExtractionResult {
    entities: CozoEntity[];
    relationships: CozoEntityEdge[];
    confidence: number;
    tokensUsed?: number;
    provider?: string;
    model?: string;
}

// ============================================
// MASTRA SETUP (DISABLED FOR CLIENT-SIDE)
// ============================================

/**
 * Create Mastra instance with configured provider
 */
function createMastraInstance(config: LLMExtractionConfig) {
    throw new Error("Mastra extraction is disabled in client-side build");
    /*
    let modelProvider;

    switch (config.provider) {
        case 'gemini':
            modelProvider = createGoogleGenerativeAI({
                apiKey: config.apiKey,
            })(config.model || 'gemini-2.0-flash-exp');
            break;

        case 'openai':
            modelProvider = createOpenAI({
                apiKey: config.apiKey,
            })(config.model || 'gpt-4o');
            break;

        case 'openrouter':
            modelProvider = createOpenAI({
                apiKey: config.apiKey,
                baseURL: 'https://openrouter.ai/api/v1',
            })(config.model || 'openai/gpt-4o');
            break;

        case 'anthropic':
            modelProvider = createAnthropic({
                apiKey: config.apiKey,
            })(config.model || 'claude-3-5-sonnet-20241022');
            break;

        default:
            throw new Error(`Unknown provider: ${config.provider}`);
    }

    const agent = new Agent({
        name: 'Entity Extractor',
        model: modelProvider,
        instructions: 'You are an expert entity extractor for storytelling and knowledge graphs.',
    });

    return new Mastra({
        agents: { extractor: agent },
    });
    */
}

// ============================================
// EXTRACTION
// ============================================

/**
 * Extract entities and relationships using LLM (Mastra-powered)
 */
export async function extractEntitiesWithLLM(
    text: string,
    episodeId: string,
    groupId: string,
    scopeType: 'note' | 'folder' | 'vault',
    config: LLMExtractionConfig
): Promise<LLMExtractionResult> {
    console.warn(`[LLM Extractor] Extraction disabled in client build`);
    
    // Return empty result
    return {
        entities: [],
        relationships: [],
        confidence: 0,
        tokensUsed: 0,
        provider: config.provider,
        model: config.model,
    };
    
    /*
    console.log(`[LLM Extractor] Using ${config.provider}/${config.model || 'default'}`);

    // Create Mastra instance
    const mastra = createMastraInstance(config);
    const agent = mastra.getAgent('extractor');

    // Build prompt
    const prompt = buildExtractionPrompt(text, config);

    // Call LLM with structured output (Zod schema validation)
    try {
        const result = await agent.generate(
            [{ role: 'user', content: prompt }],
            {
                output: ExtractionOutputSchema,
            }
        );

        // Mastra/AI SDK structured output usually in .object
        // fallback to parsing .text if needed, but .object is expected with 'output' schema
        const parsed = (result as any).object || JSON.parse((result as any).text);

        // Convert to CozoDB entities
        const entities: CozoEntity[] = parsed.entities.map((e: z.infer<typeof EntitySchema>) => {
            let kind = e.type as string;
            // Map non-standard types to constraints
            if (kind === 'PERSON') kind = 'CHARACTER';
            if (kind === 'ORGANIZATION') kind = 'FACTION';

            return {
                id: uuid(),
                name: e.name,
                entityKind: kind as any,
                entitySubtype: e.subtype,
                groupId,
                scopeType,
                createdAt: new Date(),
                extractionMethod: 'llm',
                summary: e.summary,
                aliases: e.aliases,
                frequency: 1,
                participants: [],
                attributes: e.attributes,
            };
        });

        // Create entity lookup map
        const entityMap = new Map(entities.map(e => [e.name, e.id]));

        // Convert relationships to edges
        const relationships: CozoEntityEdge[] = parsed.relationships
            .filter(r => entityMap.has(r.source_entity) && entityMap.has(r.target_entity))
            .map(r => ({
                id: uuid(),
                sourceId: entityMap.get(r.source_entity)!,
                targetId: entityMap.get(r.target_entity)!,
                createdAt: new Date(),
                validAt: new Date(),
                groupId,
                scopeType,
                edgeType: r.edge_type,
                fact: r.fact,
                episodeIds: [episodeId],
                noteIds: [],
                weight: 1,
                confidence: r.confidence,
                extractionMethods: ['llm'],
            }));

        return {
            entities,
            relationships,
            confidence: parsed.confidence,
            tokensUsed: (result as any).usage?.totalTokens,
            provider: config.provider,
            model: config.model,
        };

    } catch (error: any) {
        console.error('[LLM Extractor] Error:', error);

        // Graceful degradation (return empty results)
        return {
            entities: [],
            relationships: [],
            confidence: 0,
            tokensUsed: 0,
        };
    }
    */
}

// ============================================
// PROMPT BUILDING
// ============================================

/**
 * Build LLM prompt for entity extraction
 */
function buildExtractionPrompt(
    text: string,
    config: LLMExtractionConfig
): string {
    const entityTypes = config.customEntityTypes || [
        'CHARACTER', 'LOCATION', 'NPC', 'ITEM', 'FACTION',
        'SCENE', 'EVENT', 'CONCEPT', 'ORGANIZATION', 'PERSON',
    ];

    let prompt = `Extract entities and relationships from this storytelling text.

**Entity types to find**: ${entityTypes.join(', ')}
`;

    // Custom entity descriptions (if provided)
    if (config.customEntityDescriptions) {
        prompt += `\n**Entity type descriptions**:\n`;
        for (const [type, desc] of Object.entries(config.customEntityDescriptions)) {
            prompt += `- ${type}: ${desc}\n`;
        }
    }

    prompt += `

**Text to analyze**:
"""
${text}
"""

**Instructions**:
1. Extract ALL entities mentioned in the text (people, places, things, events, concepts)
2. Identify relationships between entities
3. Use clear, semantic edge_type names (WORKS_AT, ALLY_OF, LOCATED_IN, OWNS, PARTICIPATES_IN, etc.)
4. Only extract what's explicitly mentioned (no hallucinations)
5. Include confidence scores (0.0-1.0)

**Output format** (will be validated):
- entities: Array of {name, type, subtype?, summary?, confidence, aliases[], attributes?}
- relationships: Array of {source_entity, target_entity, fact, edge_type, confidence}
- confidence: Overall extraction confidence (0.0-1.0)

**Examples**:
- Entity: {name: "Jon Snow", type: "CHARACTER", subtype: "PROTAGONIST", summary: "Lord Commander of the Night's Watch", confidence: 0.95, aliases: ["Jon", "Lord Snow"]}
- Relationship: {source_entity: "Jon Snow", target_entity: "Night's Watch", fact: "Jon Snow commands the Night's Watch", edge_type: "COMMANDS", confidence: 0.9}
`;

    return prompt;
}
