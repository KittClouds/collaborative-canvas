import React, { useMemo } from 'react';
import { useNotes } from '@/contexts/NotesContext';
import { useLinkIndex } from '@/hooks/useLinkIndex';
import { EntityMentionsPanel as EntityList } from '@/components/EntityMentionsPanel';

export function EntitiesPanel() {
    const { state, selectNote } = useNotes();
    // We pass state.notes to useLinkIndex to ensure it updates when notes change
    const { getAllEntityStats, getEntityMentions } = useLinkIndex(state.notes);

    const entityStats = useMemo(() => getAllEntityStats(), [getAllEntityStats, state.notes]);

    const handleNavigate = (title: string) => {
        // Find note by title
        const note = state.notes.find(n => n.title === title);
        if (note) {
            selectNote(note.id);
        }
    };

    return (
        <EntityList
            entityStats={entityStats}
            getEntityMentions={getEntityMentions}
            onNavigate={handleNavigate}
        />
    );
}
