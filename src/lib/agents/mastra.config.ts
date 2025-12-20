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
  modelProvider: 'openai', // Default, can be changed
  modelName: 'gpt-4o',
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
  modelProvider: 'openai',
  modelName: 'gpt-4o',
  tools: tools,
  maxSteps: 8, // Allow multi-step tool execution for complex queries
};

/**
 * Model Provider Configuration
 * Supports OpenAI, Google, Anthropic, and OpenRouter
 */
export type ModelProvider = 'openai' | 'google' | 'anthropic' | 'openrouter';

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
 */
export const availableModels: ModelConfig[] = [
  // OpenAI
  {
    provider: 'openai',
    modelId: 'gpt-4o',
    displayName: 'GPT-4o',
    description: 'Most capable OpenAI model',
    contextWindow: 128000,
  },
  {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    description: 'Fast and affordable',
    contextWindow: 128000,
  },

  // Google
  {
    provider: 'google',
    modelId: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    description: 'Fast multimodal model',
    contextWindow: 1000000,
  },
  {
    provider: 'google',
    modelId: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    description: 'Best Gemini model',
    contextWindow: 2000000,
  },

  // Anthropic
  {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    description: 'Latest Claude model',
    contextWindow: 200000,
  },
  {
    provider: 'anthropic',
    modelId: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    description: 'Fast and efficient',
    contextWindow: 200000,
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
    modelId: 'deepseek/deepseek-r1:free',
    displayName: 'DeepSeek R1',
    description: 'DeepSeek reasoning model - FREE',
    contextWindow: 128000,
    isFree: true,
  },
  {
    provider: 'openrouter',
    modelId: 'google/gemma-3-27b-it:free',
    displayName: 'Gemma 3 27B',
    description: 'Google open model - FREE',
    contextWindow: 96000,
    isFree: true,
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
