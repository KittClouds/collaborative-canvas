/**
 * Concept Scope Configuration
 * Defines the scope for text-analysis/co-occurrence (InfraNodus style) projections.
 */

export type ConceptTarget = 'note' | 'folder';

export interface ConceptScope {
    type: 'concept';
    target: ConceptTarget;

    // Required context
    contextId: string;

    // Analysis parameters
    windowSize?: number; // Logic proximity window (default: 4)
    stemming?: boolean;  // Merge variations (run -> running)
    stopWords?: boolean; // Remove common words

    // Graph pruning
    minCoOccurrence?: number; // Minimum weight to show edge
    topK?: number; // Keep only top K nodes by centrality
}
