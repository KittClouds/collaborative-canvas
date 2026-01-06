import React, { useMemo, useState, useCallback } from 'react';
import { useCozoContext } from '@/contexts/CozoContext';
import { useLinkIndex } from '@/hooks/useLinkIndex';
import { EntityMentionsPanel as EntityList } from '@/components/EntityMentionsPanel';
import { EntityPanelLoading, EntityPanelError, CreateEntityDialog } from '@/components/entities';
import type { EntityKind } from '@/lib/types/entityTypes';
import { useJotaiNotes } from '@/hooks/useJotaiNotes';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function EntitiesPanel() {
    const { state, selectNote } = useJotaiNotes();
    const {
        isReady,
        isInitializing,
        error,
        entities,
        refreshEntities,
        deleteEntity,
        clearAllEntities
    } = useCozoContext();
    const { getEntityMentions: getLinkIndexMentions } = useLinkIndex(state.notes);

    const [useFallback, setUseFallback] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const { getAllEntityStats: getFallbackStats, getEntityMentions: getFallbackMentions } = useLinkIndex(state.notes);

    const currentNoteId = state.selectedNoteId || undefined;

    const entityStats = useMemo(() => {
        if (useFallback || !isReady) {
            return getFallbackStats();
        }

        return entities.map(entity => {
            const mentions = getLinkIndexMentions(entity.label, entity.kind);

            return {
                id: entity.id, // Include ID for deletion
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

    const handleDeleteEntity = useCallback(async (id: string, label: string) => {
        const success = await deleteEntity(id);
        if (success) {
            toast.success('Entity deleted', {
                description: `"${label}" has been removed from the registry.`,
            });
        } else {
            toast.error('Failed to delete entity', {
                description: 'Please try again.',
            });
        }
    }, [deleteEntity]);

    const handleClearAllEntities = useCallback(async () => {
        setIsClearing(true);
        try {
            await clearAllEntities();
            toast.success('Registry cleared', {
                description: 'All entities have been removed from the registry.',
            });
        } catch (err) {
            toast.error('Failed to clear registry', {
                description: 'Please try again.',
            });
        } finally {
            setIsClearing(false);
        }
    }, [clearAllEntities]);

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
            <div className="px-3 pb-3 space-y-2">
                <CreateEntityDialog
                    currentNoteId={currentNoteId}
                    onEntityCreated={handleEntityCreated}
                />

                {/* Flush Registry Button */}
                {entities.length > 0 && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-muted-foreground hover:text-destructive hover:border-destructive/50 gap-2"
                                disabled={isClearing}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                {isClearing ? 'Clearing...' : 'Flush Registry'}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-destructive" />
                                    Clear All Entities?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete <strong>all {entities.length} entities</strong> from the registry.
                                    <br /><br />
                                    Entity mentions in your notes will remain unchanged, but they will no longer be tracked until new entities are added.
                                    <br /><br />
                                    <span className="text-destructive font-medium">This action cannot be undone.</span>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={handleClearAllEntities}
                                >
                                    Yes, Clear All
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
            <EntityList
                entityStats={entityStats}
                getEntityMentions={getEntityMentions}
                onNavigate={handleNavigate}
                onDeleteEntity={handleDeleteEntity}
            />
        </div>
    );
}

export default EntitiesPanel;
