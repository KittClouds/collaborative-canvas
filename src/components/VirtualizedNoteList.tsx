/**
 * Virtualized note list using react-window + splitAtom
 * Renders 1000+ notes without performance issues
 */
import { useAtomValue } from 'jotai';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { splitSortedNotesAtom } from '@/atoms/notes-virtualized';
import { VirtualizedNoteRow } from './VirtualizedNoteRow';

interface VirtualizedNoteListProps {
    className?: string;
}

export const VirtualizedNoteList = ({ className }: VirtualizedNoteListProps) => {
    // Get array of note atoms (not notes themselves)
    const noteAtoms = useAtomValue(splitSortedNotesAtom);

    return (
        <div className={className} style={{ height: '100%' }}>
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        height={height}
                        width={width}
                        itemCount={noteAtoms.length}
                        itemSize={60} // Height of each row in pixels
                        overscanCount={5} // Render 5 extra items above/below viewport
                    >
                        {({ index, style }) => (
                            <VirtualizedNoteRow
                                key={index}
                                noteAtom={noteAtoms[index]}
                                style={style}
                            />
                        )}
                    </List>
                )}
            </AutoSizer>
        </div>
    );
};
