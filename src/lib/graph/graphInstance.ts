
import { UnifiedGraph } from './UnifiedGraph';
import { initializeRelationshipOrchestrator } from './integration/RelationshipOrchestrator';

export const unifiedGraph = new UnifiedGraph();

// Initialize orchestrator with the graph instance
initializeRelationshipOrchestrator(unifiedGraph);

// Re-export the orchestrator for use in the app
export { relationshipOrchestrator } from './integration/RelationshipOrchestrator';
