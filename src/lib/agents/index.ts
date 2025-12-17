/**
 * Agents Module - Exports all agent functionality
 */

// Tools
export {
    tools,
    searchVectorTool,
    searchGraphTool,
    searchFtsTool,
    getEntityTool,
    findPathTool,
    getHistoryTool,
    analyzeCommunitiesTool,
    // MetaSearch Orchestration Tools
    analyzeQueryTool,
    rerankResultsTool,
    shouldExpandGraphTool,
} from './tools';

// Configuration
export { agentConfig, metaSearchAgentConfig } from './mastra.config';

// Chat Service
export { chatService } from './chatService';
export type { ChatRequest, ModelProvider } from './chatService';

// MetaSearch
export {
    metaSearch,
    metaSearchStream,
    quickSearch
} from './metaSearch';
export type {
    MetaSearchOptions,
    MetaSearchResult
} from './metaSearch';
