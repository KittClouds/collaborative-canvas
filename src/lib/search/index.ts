export {
  search,
  setSearchContext,
  type SearchRequest,
  type SearchResult,
  type SearchResponse,
  type SearchContext,
} from './searchOrchestrator';

export {
  searchNotesByVector,
  findSimilarNotes,
  type VectorSearchOptions,
  type VectorSearchResult,
} from './vectorSearch';

export {
  expandResultsViaGraph,
  type GraphExpansionOptions,
  type ExpandedResult,
} from './graphExpansion';
