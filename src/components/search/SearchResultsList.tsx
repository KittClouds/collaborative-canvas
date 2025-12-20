import { TrendingUp, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { SearchResult } from '@/lib/search/searchOrchestrator';

interface SearchResultsListProps {
  results: SearchResult[];
  isLoading: boolean;
  query: string;
  onResultClick: (noteId: string) => void;
}

export function SearchResultsList({
  results,
  isLoading,
  query,
  onResultClick,
}: SearchResultsListProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">
          Searching...
        </div>
      </div>
    );
  }

  if (results.length === 0 && query.trim()) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
        <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No results found</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Try syncing more notes or adjusting your query
        </p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
        <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">Enter a search query</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Semantic search finds related notes by meaning
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-2 p-1">
        {results.map((result) => (
          <SearchResultItem
            key={result.noteId}
            result={result}
            query={query}
            onClick={() => onResultClick(result.noteId)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  query: string;
  onClick: () => void;
}

function SearchResultItem({ result, query, onClick }: SearchResultItemProps) {
  const scorePercent = Math.round(result.score * 100);

  return (
    <div
      className="p-3 rounded-md border bg-card hover:bg-accent cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-sm truncate flex-1">
          {result.noteTitle}
        </span>
        <Badge variant="secondary" className="text-xs shrink-0">
          {scorePercent}%
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2">
        {highlightQuery(result.snippet, query)}
      </p>

      <div className="flex items-center gap-2 mt-2">
        {result.graphExpanded && (
          <div className="flex items-center gap-1 text-xs text-blue-500">
            <TrendingUp className="h-3 w-3" />
            <span>Graph-expanded</span>
          </div>
        )}

        {result.entityMatches.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {result.entityMatches.slice(0, 2).map((entity, i) => (
              <Badge key={i} variant="outline" className="text-[10px] px-1 py-0">
                {entity}
              </Badge>
            ))}
            {result.entityMatches.length > 2 && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                +{result.entityMatches.length - 2}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function highlightQuery(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return text;

  const regex = new RegExp(`(${words.map(escapeRegex).join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isMatch = words.some(w => part.toLowerCase() === w);
    if (isMatch) {
      return (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {part}
        </mark>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
