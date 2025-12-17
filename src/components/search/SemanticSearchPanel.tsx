import { useState, useCallback } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmbeddingHealthCard } from './EmbeddingHealthCard';
import { SyncScopeSelector } from './SyncScopeSelector';
import { SearchResultsList } from './SearchResultsList';
import { useSearch } from '@/contexts/SearchContext';
import { useNotes } from '@/contexts/NotesContext';

export function SemanticSearchPanel() {
  const { selectNote } = useNotes();
  const {
    query,
    setQuery,
    results,
    isSearching,
    searchMetadata,
    embeddingHealth,
    executeSearch,
    selectedModel,
    setSelectedModel,
  } = useSearch();

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeSearch();
    }
  }, [executeSearch]);

  const handleResultClick = useCallback((noteId: string) => {
    selectNote(noteId);
  }, [selectNote]);

  return (
    <div className="flex flex-col h-full gap-3 p-2">
      <EmbeddingHealthCard health={embeddingHealth} />

      <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as 'small' | 'medium')}>
        <SelectTrigger className="w-full h-8 text-xs">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="small">
            <span className="font-medium">Fast (Small)</span>
            <span className="text-muted-foreground ml-2 text-xs">256-dim</span>
          </SelectItem>
          <SelectItem value="medium">
            <span className="font-medium">Deep (Medium)</span>
            <span className="text-muted-foreground ml-2 text-xs">768-dim</span>
          </SelectItem>
        </SelectContent>
      </Select>

      <SyncScopeSelector />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search notes... (Ctrl+K)"
          className="pl-9 pr-2 bg-sidebar-accent border-0 focus-visible:ring-1 focus-visible:ring-sidebar-ring"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {searchMetadata && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <span>{searchMetadata.totalResults} results</span>
          <span>•</span>
          <span>{searchMetadata.searchTime}ms</span>
          {searchMetadata.graphExpanded && (
            <>
              <span>•</span>
              <span className="text-blue-500">Graph-expanded</span>
            </>
          )}
        </div>
      )}

      <SearchResultsList
        results={results}
        isLoading={isSearching}
        query={query}
        onResultClick={handleResultClick}
      />
    </div>
  );
}
