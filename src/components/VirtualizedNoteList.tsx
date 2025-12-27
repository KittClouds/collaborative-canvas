import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAtomValue } from 'jotai';
import { noteIdsAtom, noteAtomFamily } from '@/atoms/notes-atomic';
import { cn } from '@/lib/utils';

/**
 * VirtualizedNoteList
 * Efficiently renders large lists of notes using windowing.
 * Replaces react-window implementation with @tanstack/react-virtual + atomFamily.
 */
export function VirtualizedNoteList({ className }: { className?: string }) {
    const noteIds = useAtomValue(noteIdsAtom);
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: noteIds.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100, // Estimated note card height
        overscan: 5, // Render 5 extra items above/below viewport
    });

    return (
        <div
            ref={parentRef}
            className={cn("h-full w-full overflow-auto", className)}
        >
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualItem) => {
                    const noteId = noteIds[virtualItem.index];
                    return (
                        <VirtualNoteCard
                            key={noteId}
                            noteId={noteId}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualItem.start}px)`,
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function VirtualNoteCard({ noteId, style }: { noteId: string; style: React.CSSProperties }) {
    // Only subscribes to this specific note's updates
    const note = useAtomValue(noteAtomFamily(noteId));

    if (!note) return null;

    return (
        <div
            style={style}
            className="p-4 border-b hover:bg-muted/50 transition-colors cursor-pointer"
        >
            <h3 className="font-medium text-sm mb-1">{note.title || 'Untitled'}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">
                {note.content?.slice(0, 150) || 'No content'}
            </p>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                <span>{new Date(note.updatedAt || 0).toLocaleDateString()}</span>
            </div>
        </div>
    );
}
