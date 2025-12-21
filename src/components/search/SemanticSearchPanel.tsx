import { useState, useCallback } from 'react';
import { Search, Sparkles, Network } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EmbeddingHealthCard } from './EmbeddingHealthCard';
import { SyncScopeSelector } from './SyncScopeSelector';
import { SearchResultsList } from './SearchResultsList';
import { useSearch } from '@/contexts/SearchContext';
import { useNotes } from '@/contexts/NotesContext';

type SearchMode = 'semantic' | 'hybrid';

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
    searchMode,
    setSearchMode,
    hybridWeights,
    setHybridWeights,
  } = useSearch();

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Helper setters for individual weights
  const setVectorWeight = (v: number) => setHybridWeights({ ...hybridWeights, vector: v });
  const setGraphWeight = (v: number) => setHybridWeights({ ...hybridWeights, graph: v });
  const setLexicalWeight = (v: number) => setHybridWeights({ ...hybridWeights, lexical: v });

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeSearch();
    }
  }, [executeSearch]);

  const handleResultClick = useCallback((noteId: string) => {
    selectNote(noteId);
  }, [selectNote]);

  const handleSearchModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
  };

  // Normalize weights to sum to 1
  const normalizeWeights = () => {
    const total = hybridWeights.vector + hybridWeights.graph + hybridWeights.lexical;
    if (total > 0) {
      setHybridWeights({
        vector: hybridWeights.vector / total,
        graph: hybridWeights.graph / total,
        lexical: hybridWeights.lexical / total,
      });
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 p-2">
      <EmbeddingHealthCard health={embeddingHealth} />

      {/* Search Mode Toggle */}
      <div className="flex gap-1 p-1 bg-sidebar-accent rounded-md">
        <button
          onClick={() => handleSearchModeChange('semantic')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${searchMode === 'semantic'
              ? 'bg-sidebar text-sidebar-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Semantic
        </button>
        <button
          onClick={() => handleSearchModeChange('hybrid')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${searchMode === 'hybrid'
              ? 'bg-sidebar text-sidebar-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <Network className="w-3.5 h-3.5" />
          Hybrid
        </button>
      </div>

      {/* Mode Description */}
      <div className="px-2 py-1.5 bg-sidebar-accent/50 rounded-md text-xs text-muted-foreground">
        {searchMode === 'semantic' ? (
          <span>🧠 Understanding-based search using embeddings</span>
        ) : (
          <span>🔮 Combined search with graph relationships</span>
        )}
      </div>

      {/* Model Selection */}
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

      {/* Hybrid Advanced Controls */}
      {searchMode === 'hybrid' && (
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-xs h-8"
            >
              <span className="flex items-center gap-2">
                ⚙️ Fusion Weights
              </span>
              <span className="text-muted-foreground">
                {showAdvanced ? '▼' : '▶'}
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="px-2 space-y-3">
              {/* Vector Weight */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium">Vector (Semantic)</label>
                  <span className="text-xs text-muted-foreground">{hybridWeights.vector.toFixed(2)}</span>
                </div>
                <Slider
                  value={[hybridWeights.vector]}
                  onValueChange={([v]) => setVectorWeight(v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              {/* Graph Weight */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium">Graph (Relations)</label>
                  <span className="text-xs text-muted-foreground">{hybridWeights.graph.toFixed(2)}</span>
                </div>
                <Slider
                  value={[hybridWeights.graph]}
                  onValueChange={([v]) => setGraphWeight(v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              {/* Lexical Weight */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium">Lexical (Keywords)</label>
                  <span className="text-xs text-muted-foreground">{hybridWeights.lexical.toFixed(2)}</span>
                </div>
                <Slider
                  value={[hybridWeights.lexical]}
                  onValueChange={([v]) => setLexicalWeight(v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              {/* Normalize Button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7"
                onClick={normalizeWeights}
              >
                Normalize Weights
              </Button>

              {/* Weight Sum Display */}
              <div className="text-xs text-center text-muted-foreground">
                Sum: {(hybridWeights.vector + hybridWeights.graph + hybridWeights.lexical).toFixed(2)}
                {Math.abs((hybridWeights.vector + hybridWeights.graph + hybridWeights.lexical) - 1.0) > 0.01 && (
                  <span className="text-yellow-500 ml-2">⚠️ Should equal 1.0</span>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Scope Selector (works for both modes) */}
      <SyncScopeSelector />

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={
            searchMode === 'semantic'
              ? 'Search by meaning...'
              : 'Hybrid search (meaning + relations)...'
          }
          className="pl-9 pr-2 bg-sidebar-accent border-0 focus-visible:ring-1 focus-visible:ring-sidebar-ring"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Search Metadata */}
      {searchMetadata && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <span>{searchMetadata.totalResults} results</span>
          <span>•</span>
          <span>{searchMetadata.searchTime}ms</span>
          {searchMode === 'hybrid' && (
            <>
              <span>•</span>
              <span className="text-purple-500">Hybrid mode</span>
            </>
          )}
          {searchMetadata.graphExpanded && (
            <>
              <span>•</span>
              <span className="text-blue-500">Graph-expanded</span>
            </>
          )}
        </div>
      )}

      {/* Results */}
      <SearchResultsList
        results={results}
        isLoading={isSearching}
        query={query}
        onResultClick={handleResultClick}
        searchMode={searchMode}
      />
    </div>
  );
}
