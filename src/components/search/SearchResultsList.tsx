import { useState, useCallback } from 'react';
import { FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import type { SearchResult } from '@/lib/db/search';

interface SearchResultsListProps {
  results: SearchResult[];
  isLoading: boolean;
  query: string;
  onResultClick: (noteId: string) => void;
  searchMode?: 'semantic' | 'hybrid';
}

export function SearchResultsList({
  results,
  isLoading,
  query,
  onResultClick,
  searchMode = 'semantic'
}: SearchResultsListProps) {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleExpanded = (nodeId: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!query) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Enter a search query
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        No results found
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-2 pr-3">
        {results.map((result) => {
          const isExpanded = expandedResults.has(result.node_id);
          const breakdown = searchMode === 'hybrid' ? result.metadata?.breakdown : undefined;

          return (
            <Card
              key={result.node_id}
              className="cursor-pointer hover:bg-sidebar-accent/50 transition-colors"
              onClick={() => onResultClick(result.node_id)}
            >
              <CardContent className="p-3 space-y-2">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{result.label}</h4>
                      {result.metadata?.type && (
                        <span className="text-xs text-muted-foreground">
                          {result.metadata.type}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score Badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-primary">
                      {(result.score * 100).toFixed(0)}%
                    </span>
                    <span className="px-1.5 py-0.5 text-xs bg-sidebar-accent rounded">
                      {result.source}
                    </span>
                  </div>
                </div>

                {/* Content Preview */}
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {result.content.slice(0, 150)}
                  {result.content.length > 150 && '...'}
                </p>

                {/* Hybrid Breakdown */}
                {breakdown && (
                  <div className="space-y-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(result.node_id);
                      }}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      Score Breakdown
                    </button>

                    {isExpanded && (
                      <div className="space-y-2 pl-5">
                        {/* Visual Breakdown */}
                        <div className="space-y-1">
                          <ScoreBar
                            label="Lexical"
                            value={breakdown.lexical}
                            color="bg-blue-500"
                          />
                          <ScoreBar
                            label="Vector"
                            value={breakdown.vector}
                            color="bg-purple-500"
                          />
                          <ScoreBar
                            label="Graph"
                            value={breakdown.graph}
                            color="bg-green-500"
                          />
                        </div>

                        {/* Applied Weights */}
                        <div className="text-xs text-muted-foreground">
                          Weights: L={breakdown.weights.lexical.toFixed(2)},
                          V={breakdown.weights.vector.toFixed(2)},
                          G={breakdown.weights.graph.toFixed(2)}
                        </div>

                        {/* Graph Signal Details (if available) */}
                        {breakdown.graphSignal && (
                          <div className="text-xs space-y-1 text-muted-foreground">
                            <div className="font-medium">Graph Signals:</div>
                            <div className="pl-2 space-y-0.5">
                              <div>Degree: {breakdown.graphSignal.degree}</div>
                              <div>Centrality: {breakdown.graphSignal.centrality.toFixed(3)}</div>
                              {breakdown.graphSignal.connectedToCandidates > 0 && (
                                <div>Connected: {breakdown.graphSignal.connectedToCandidates} candidates</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// Helper component for score visualization
function ScoreBar({
  label,
  value,
  color
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-sidebar-accent rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}
