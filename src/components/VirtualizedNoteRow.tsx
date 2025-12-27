/**
 * Individual note row for virtualized list
 * Only re-renders when its specific note changes
 */
import { useAtom, useSetAtom, type Atom } from 'jotai';
import { selectedNoteIdAtom } from '@/atoms/notes';
import { cn } from '@/lib/utils';
import type { Note } from '@/types/noteTypes';

interface VirtualizedNoteRowProps {
    noteAtom: Atom<Note>;
    style: React.CSSProperties;
}

export const VirtualizedNoteRow = ({ noteAtom, style }: VirtualizedNoteRowProps) => {
    // Only subscribes to THIS note's atom
    const [note] = useAtom(noteAtom);
    const setSelectedId = useSetAtom(selectedNoteIdAtom);

    const handleClick = () => {
        setSelectedId(note.id);
    };

    const formatDate = (timestamp: number | undefined) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div
            style={style}
            className={cn(
                'flex items-center gap-3 px-4 py-2 cursor-pointer',
                'hover:bg-accent transition-colors',
                'border-b border-border'
            )}
            onClick={handleClick}
        >
            {/* Favorite indicator */}
            {Number(note.favorite) === 1 && (
                <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
            )}

            {/* Note content */}
            <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                    {note.title || 'Untitled'}
                </div>
                {note.content && (
                    <div className="text-xs text-muted-foreground truncate">
                        {note.content.substring(0, 100)}
                    </div>
                )}
            </div>

            {/* Date */}
            <div className="text-xs text-muted-foreground flex-shrink-0">
                {formatDate(note.updatedAt ?? note.updated_at)}
            </div>
        </div>
    );
};
