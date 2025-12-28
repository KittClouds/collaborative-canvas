/**
 * Graph Library Index
 * 
 * Note: Cytoscape wrappers (UnifiedGraph, GraphBridge, graphInstance) have been removed.
 * Transitioning to CozoDB as the primary graph engine.
 */

// ✅ KEEP: Pure data models and builders
export { ConceptGraphBuilder } from './ConceptGraphBuilder';
export * from './types';

// ✅ New Cozo-based extractors will be exported here or in their own namespace
export { NERExtractor, getNERExtractor } from './extractors/NERExtractor';
export { LLMExtractor, getLLMExtractor } from './extractors/LLMExtractor';

// ===== GRAPH VISUALIZATION API =====

// Layer 1: Data Providers
export {
    getObsidianGraphData,
    getEntityGraphData,
    getCooccurrenceGraphData,
    getUnifiedGraphData,
    getNetworkGraphData,
    type GraphFilter,
    type GraphScope,
    type RawGraphData,
    type RawNode,
    type RawEdge,
} from './data-providers';

// Layer 2: Enrichment
export {
    enrichGraphData,
    enrichNode,
    enrichEdge,
    applyPageRankSizing,
    applyCommunityColors,
    filterByConfidence,
    type EnrichedGraphData,
    type EnrichedNode,
    type EnrichedEdge,
} from './enrichment';

// Layer 3: Transformers
export {
    toCytoscapeElements,
    toD3Graph,
    toGraphologyData,
    suggestLayout,
    generateCytoscapeStylesheet,
    type OutputFormat,
    type CytoscapeElements,
    type CytoscapeNode,
    type CytoscapeEdge,
    type D3Graph,
    type D3Node,
    type D3Link,
    type GraphologyData,
    type LayoutHints,
} from './transformers';

// Unified API
export {
    getGraphVisualization,
    getObsidianGraph,
    getEntityGraph,
    getConceptGraph,
    getNetworkGraph,
    type GraphVisualizationOptions,
    type VisualizationResult,
} from './visualization-api';
