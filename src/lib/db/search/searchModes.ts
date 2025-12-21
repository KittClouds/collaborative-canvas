// src/lib/db/search/searchModes.ts

export type SearchMode = 'lexical' | 'semantic' | 'hybrid';

export interface SearchModeConfig {
    mode: SearchMode;
    description: string;
    icon: string;
    features: string[];
    useCases: string[];
}

export const SEARCH_MODES: Record<SearchMode, SearchModeConfig> = {
    lexical: {
        mode: 'lexical',
        description: 'Fast keyword-based search using BM25',
        icon: '⚡',
        features: ['Exact matches', 'Boolean operators', 'Instant results'],
        useCases: ['Finding specific terms', 'Title search', 'Quick lookups'],
    },
    semantic: {
        mode: 'semantic',
        description: 'Understanding-based search using embeddings',
        icon: '🧠',
        features: ['Concept matching', 'Paraphrase detection', 'Context-aware'],
        useCases: ['Exploring ideas', 'Finding similar content', 'Conceptual queries'],
    },
    hybrid: {
        mode: 'hybrid',
        description: 'Combined search with graph relationships',
        icon: '🔮',
        features: ['Best of both worlds', 'Graph context', 'Adaptive scoring'],
        useCases: ['Complex queries', 'Related entities', 'Deep exploration'],
    },
};
