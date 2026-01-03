/**
 * RankedSearchResults
 * 
 * Displays search results from ResoRank with relevance scores.
 */

import { FileText, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJotaiNotes } from '@/hooks/useJotaiNotes';
import type { ResoRankSearchResult } from '@/lib/search/ResoRankFacade';

interface RankedSearchResultsProps {
    results: ResoRankSearchResult[];
    onSelect: (id: string) => void;
    className?: string;
}

export function RankedSearchResults({ results, onSelect, className }: RankedSearchResultsProps) {
    const { state } = useJotaiNotes();

    if (results.length === 0) {
        return (
            <div className={cn("flex flex-col items-center justify-center py-8 text-muted-foreground", className)}>
                <Search className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No results found</p>
            </div>
        );
    }

    // Normalize scores for display (0-100%)
    const maxScore = Math.max(...results.map(r => r.score));
    const normalizedResults = results.map(r => ({
        ...r,
        displayScore: maxScore > 0 ? (r.score / maxScore) * 100 : 0,
    }));

    return (
        <div className={cn("space-y-1", className)}>
            <div className="text-xs text-muted-foreground px-2 mb-2">
                {results.length} result{results.length !== 1 ? 's' : ''}
            </div>

            {normalizedResults.map((result) => {
                const note = state.notes.find(n => n.id === result.doc_id);
                if (!note) return null;

                const isActive = state.selectedNoteId === result.doc_id;

                return (
                    <button
                        key={result.doc_id}
                        onClick={() => onSelect(result.doc_id)}
                        className={cn(
                            "w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors",
                            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                        )}
                    >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />

                        <span className="flex-1 text-left truncate">
                            {note.title || 'Untitled Note'}
                        </span>

                        {/* Score badge */}
                        <span
                            className={cn(
                                "text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0",
                                result.displayScore >= 80
                                    ? "bg-teal-500/20 text-teal-400"
                                    : result.displayScore >= 50
                                        ? "bg-blue-500/20 text-blue-400"
                                        : "bg-zinc-500/20 text-zinc-400"
                            )}
                        >
                            {result.displayScore.toFixed(0)}%
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
