import React, { useMemo, useState, useCallback } from 'react';
import { useNotes } from '@/contexts/NotesContext';
import { useCozoContext } from '@/contexts/CozoContext';
import { useLinkIndex } from '@/hooks/useLinkIndex';
import { EntityMentionsPanel as EntityList } from '@/components/EntityMentionsPanel';
import { EntityPanelLoading, EntityPanelError, CreateEntityDialog } from '@/components/entities';
import type { EntityKind } from '@/lib/entities/entityTypes';

export function EntitiesPanel() {
    const { state, selectNote } = useNotes();
    const { isReady, isInitializing, error, entities, refreshEntities } = useCozoContext();
    const { getEntityMentions: getLinkIndexMentions } = useLinkIndex(state.notes);

    const [useFallback, setUseFallback] = useState(false);
    const { getAllEntityStats: getFallbackStats, getEntityMentions: getFallbackMentions } = useLinkIndex(state.notes);

    const currentNoteId = state.selectedNoteId || undefined;

    const entityStats = useMemo(() => {
        if (useFallback || !isReady) {
            return getFallbackStats();
        }

        return entities.map(entity => {
            const mentions = getLinkIndexMentions(entity.label, entity.kind);

            return {
                entityKind: entity.kind,
                entityLabel: entity.label,
                mentionsInThisNote: 0,
                mentionsAcrossVault: mentions.reduce((sum, m) => sum + m.linkCount, 0) || entity.totalMentions,
                appearanceCount: mentions.length || entity.mentionsByNote.size,
            };
        });
    }, [useFallback, isReady, entities, getLinkIndexMentions, getFallbackStats]);

    const getEntityMentions = useCallback((label: string, kind?: EntityKind) => {
        if (useFallback) {
            return getFallbackMentions(label, kind);
        }
        return getLinkIndexMentions(label, kind);
    }, [useFallback, getLinkIndexMentions, getFallbackMentions]);

    const handleNavigate = useCallback((title: string) => {
        const note = state.notes.find(n => n.title === title);
        if (note) {
            selectNote(note.id);
        }
    }, [state.notes, selectNote]);

    const handleRetry = useCallback(() => {
        window.location.reload();
    }, []);

    const handleFallback = useCallback(() => {
        setUseFallback(true);
    }, []);

    const handleEntityCreated = useCallback(() => {
        refreshEntities();
    }, [refreshEntities]);

    if (isInitializing && !useFallback) {
        return <EntityPanelLoading />;
    }

    if (error && !useFallback) {
        return (
            <EntityPanelError
                error={error}
                onRetry={handleRetry}
                onFallback={handleFallback}
            />
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="px-3 pb-3">
                <CreateEntityDialog
                    currentNoteId={currentNoteId}
                    onEntityCreated={handleEntityCreated}
                />
            </div>
            <EntityList
                entityStats={entityStats}
                getEntityMentions={getEntityMentions}
                onNavigate={handleNavigate}
            />
        </div>
    );
}

export default EntitiesPanel;
