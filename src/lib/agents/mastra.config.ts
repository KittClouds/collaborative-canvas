import { tools } from './tools';

export const agentConfig = {
  name: 'Knowledge Agent',
  instructions: `
You are an intelligent knowledge assistant connected to an in-memory graph database.
Your goal is to help the user explore their notes, find connections, and analyze their data.

You have access to the following tools:
1. searchVector: Search notes by meaning.
2. searchGraph: Explore connections around an entity.
3. searchFts: Find exact keywords.
4. getEntity: Get entity details.
5. findPath: Find paths between entities.
6. getHistory: See entity history.
7. analyzeCommunities: Detect clusters.

Guidelines:
- When asked about a topic, start with a vector search.
- If the user asks about specific connections, use graph search or path finding.
- Always cite your sources using the [Note Title](noteId) format.
- Be concise but thorough.
- If you run a tool, summarize the results clearly.
  `,
  modelProvider: 'google', // Default: Gemini
  modelName: 'gemini-2.5-flash',
  tools: tools,
};

// MetaSearch Agent Configuration
export const metaSearchAgentConfig = {
  name: 'MetaSearch Orchestrator',
  description: 'Intelligent multi-modal search agent that routes queries to appropriate search modalities',
  instructions: `You are an intelligent MetaSearch orchestrator for a knowledge graph system.

Your role:
1. Analyze user queries to understand intent
2. Route to appropriate search modalities (vector, graph, FTS, temporal, community)
3. Combine results from multiple sources intelligently
4. Present coherent, well-structured answers

Search Modalities Available:
- **Vector Search**: Semantic/conceptual queries ("similar to", "themes about")
- **FTS**: Exact name/keyword lookups ("who is Alice", "notes about React")
- **Graph Search**: Relationship exploration ("connected to", "related characters")
- **Path Finding**: Relationship paths ("how are X and Y connected")
- **Temporal**: Evolution tracking ("how has X changed over time")
- **Community Detection**: Clustering ("groups of related entities")
- **Entity Details**: Full entity metadata lookup

Orchestration Tools:
- **analyzeQuery**: Classify query intent and determine search strategy
- **rerankResults**: Merge and re-rank results from multiple modalities
- **shouldExpandGraph**: Decide if graph expansion would improve results

Strategy Guidelines:
- Use FTS + Entity for direct lookups
- Use Vector + Graph for exploratory queries
- Use Path + Graph for relationship queries
- Use History + Vector for temporal queries
- Combine multiple modalities when query is complex
- Always expand initial results with graph context when relevant`,
  modelProvider: 'google',
  modelName: 'gemini-2.5-flash',
  tools: tools,
  maxSteps: 8, // Allow multi-step tool execution for complex queries
};

/**
 * Model Provider Configuration
 * Supports Google (Gemini direct) and OpenRouter
 */
export type ModelProvider = 'google' | 'openrouter';

export interface ModelConfig {
  provider: ModelProvider;
  modelId: string;
  displayName: string;
  description: string;
  contextWindow: number;
  isFree?: boolean;
}

/**
 * Available models by provider
 * Focused on Gemini (direct) and OpenRouter (FREE tier)
 */
export const availableModels: ModelConfig[] = [
  // Gemini (Direct API)
  {
    provider: 'google',
    modelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    description: 'Latest Gemini. Fast and capable.',
    contextWindow: 1000000,
    isFree: false,
  },
  {
    provider: 'google',
    modelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    description: 'Most capable Gemini. 2M context.',
    contextWindow: 2000000,
    isFree: false,
  },
  {
    provider: 'google',
    modelId: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    description: 'Fast multimodal Gemini 2.0.',
    contextWindow: 1000000,
    isFree: false,
  },

  // OpenRouter - FREE models
  {
    provider: 'openrouter',
    modelId: 'nvidia/nemotron-3-nano-30b-a3b:free',
    displayName: 'Nemotron 3 Nano',
    description: 'NVIDIA reasoning model - FREE',
    contextWindow: 1000000,
    isFree: true,
  },
  {
    provider: 'openrouter',
    modelId: 'arcee-ai/trinity-mini:free',
    displayName: 'Trinity Mini',
    description: 'Arcee AI MoE. Function calling - FREE',
    contextWindow: 131000,
    isFree: true,
  },
  {
    provider: 'openrouter',
    modelId: 'nex-agi/deepseek-v3.1-nex-n1:free',
    displayName: 'DeepSeek V3.1 Nex N1',
    description: 'DeepSeek for agents - FREE',
    contextWindow: 128000,
    isFree: true,
  },
  {
    provider: 'openrouter',
    modelId: 'google/gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash Preview',
    description: 'Gemini 3 via OpenRouter',
    contextWindow: 1000000,
    isFree: false,
  },
];

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: ModelProvider): ModelConfig[] {
  return availableModels.filter(m => m.provider === provider);
}

/**
 * Get free models (OpenRouter)
 */
export function getFreeModels(): ModelConfig[] {
  return availableModels.filter(m => m.isFree);
}
