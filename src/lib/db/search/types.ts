import type { NodeType } from '../client/types';

export interface SearchResult {
    node_id: string;
    label: string;
    content: string;
    score: number;
    source: 'resorank' | 'vector' | 'fts' | 'hybrid';
    metadata?: {
        entity_kind?: string;
        entity_subtype?: string;
        type?: string;
        [key: string]: any;
    };
}

export interface SearchOptions {
    query: string;
    queryEmbedding?: Float32Array; // Added for Phase 4
    k?: number;
    minScore?: number;
    searchType?: 'auto' | 'resorank' | 'vector' | 'fts' | 'hybrid';
    filters?: {
        type?: NodeType;
        entity_kind?: string;
        entity_subtype?: string;
        parent_id?: string;
    };
}

export const RRF_K = 60; // Reciprocal Rank Fusion constant

export interface HybridWeights {
    resorank: number;
    vector: number;
    fts: number;
}

export const DEFAULT_HYBRID_WEIGHTS: HybridWeights = {
    resorank: 0.5,
    vector: 0.3,
    fts: 0.2,
};
