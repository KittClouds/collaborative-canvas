import { embeddingService } from '@/lib/embeddings/embeddingService';
import { searchNotesByVector } from './vectorSearch';
import { expandResultsViaGraph, ExpandedResult } from './graphExpansion';
import { rerankResults, normalizeScores } from './reranking';

export interface SearchRequest {
  query: string;
  model?: 'small' | 'medium' | 'auto';
  maxResults?: number;
  enableGraphExpansion?: boolean;
  noteIds?: string[];
}

export interface SearchResult {
  noteId: string;
  noteTitle: string;
  snippet: string;
  score: number;
  entityMatches: string[];
  graphExpanded: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  metadata: {
    totalResults: number;
    searchTime: number;
    modelUsed: 'small' | 'medium';
    graphExpanded: boolean;
  };
}

import { getNotesInDateRange } from './temporalFilters';

export interface SearchRequest {
  query: string;
  model?: 'small' | 'medium' | 'auto';
  maxResults?: number;
  enableGraphExpansion?: boolean;
  noteIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface SearchResult {
  noteId: string;
  noteTitle: string;
  snippet: string;
  score: number;
  entityMatches: string[];
  graphExpanded: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  metadata: {
    totalResults: number;
    searchTime: number;
    modelUsed: 'small' | 'medium';
    graphExpanded: boolean;
  };
}

export interface SearchContext {
  getNoteById: (id: string) => { id: string; title: string; content: string } | undefined;
}

let searchContext: SearchContext | null = null;

export function setSearchContext(context: SearchContext): void {
  searchContext = context;
}

export async function search(request: SearchRequest): Promise<SearchResponse> {
  const startTime = Date.now();

  const model = selectModel(request);
  const maxResults = request.maxResults || 10;
  const enableGraphExpansion = request.enableGraphExpansion ?? true;

  await embeddingService.initialize();

  const queryEmbedding = await embeddingService.embed(request.query, model);

  // Apply temporal filter if requested
  let noteIdsToSearch = request.noteIds;
  if (request.dateRange) {
    const timeIds = await getNotesInDateRange(request.dateRange);
    if (noteIdsToSearch) {
      // Intersection
      noteIdsToSearch = noteIdsToSearch.filter(id => timeIds.includes(id));
    } else {
      noteIdsToSearch = timeIds;
    }
  }

  const vectorResults = await searchNotesByVector({
    queryEmbedding,
    model,
    k: maxResults * 2,
    minScore: 0.1,
    noteIds: noteIdsToSearch,
  });

  let expandedResults: ExpandedResult[] = vectorResults.map(r => ({
    ...r,
    graphDistance: 0,
    connectedEntities: [] as string[],
  }));

  let graphExpanded = false;

  if (enableGraphExpansion && vectorResults.length > 0) {
    try {
      expandedResults = await expandResultsViaGraph(vectorResults, {
        maxHops: 2,
        maxExpanded: maxResults,
        minCooccurrence: 2,
      });
      graphExpanded = expandedResults.some(r => r.graphDistance && r.graphDistance > 0);
    } catch (e) {
      console.warn('Graph expansion failed, using vector results only:', e);
    }
  }

  let rankedResults = rerankResults(expandedResults, {
    vectorWeight: 0.7,
    graphWeight: 0.3,
  });

  rankedResults = normalizeScores(rankedResults);

  const finalResults = rankedResults.slice(0, maxResults);

  const searchResults: SearchResult[] = finalResults.map(result => {
    const note = searchContext?.getNoteById(result.noteId);
    const content = note?.content || '';
    const snippet = generateSnippet(content, request.query);

    return {
      noteId: result.noteId,
      noteTitle: note?.title || 'Untitled',
      snippet,
      score: result.finalScore,
      entityMatches: result.connectedEntities || [],
      graphExpanded: (result.graphDistance ?? 0) > 0,
    };
  });

  const searchTime = Date.now() - startTime;

  return {
    results: searchResults,
    metadata: {
      totalResults: rankedResults.length,
      searchTime,
      modelUsed: model,
      graphExpanded,
    },
  };
}

function selectModel(request: SearchRequest): 'small' | 'medium' {
  if (request.model === 'small' || request.model === 'medium') {
    return request.model;
  }

  if (request.query.length > 100) {
    return 'medium';
  }

  const complexPatterns = [
    /relationship between/i,
    /connected to/i,
    /similar to/i,
    /compare/i,
    /analyze/i,
    /theme/i,
    /meaning/i,
  ];

  if (complexPatterns.some(pattern => pattern.test(request.query))) {
    return 'medium';
  }

  return 'small';
}

function generateSnippet(content: string, query: string, maxLength: number = 150): string {
  let text = content;

  try {
    const parsed = JSON.parse(content);
    text = extractTextFromTiptap(parsed);
  } catch {
  }

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const textLower = text.toLowerCase();

  let bestIndex = -1;
  for (const word of queryWords) {
    const index = textLower.indexOf(word);
    if (index !== -1) {
      bestIndex = index;
      break;
    }
  }

  if (bestIndex === -1) {
    return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  const start = Math.max(0, bestIndex - Math.floor(maxLength / 2));
  const end = Math.min(text.length, start + maxLength);

  let snippet = text.slice(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

function extractTextFromTiptap(node: any): string {
  if (!node) return '';

  let text = '';

  if (node.type === 'text' && node.text) {
    text += node.text;
  }

  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractTextFromTiptap(child);
      if (child.type === 'paragraph' || child.type === 'heading') {
        text += ' ';
      }
    }
  }

  return text;
}
