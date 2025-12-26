import { useState, useEffect, useCallback } from 'react';
import { eventBus } from '@/lib/utils/event-bus';
import { bidirectionalLinkEngine } from '@/lib/entities/bidirectional-link-engine';

interface EntityInNote {
  entityId: string;
  entityName: string;
  entityKind: string;
  mentionCount: number;
  avgRelevance: number;
}

interface NoteWithEntity {
  noteId: string;
  noteTitle: string;
  mentionCount: number;
  avgRelevance: number;
  updatedAt: number;
}

interface UseBidirectionalLinksOptions {
  noteId?: string;
  entityId?: string;
  autoRefresh?: boolean;
}

export function useBidirectionalLinks(options: UseBidirectionalLinksOptions) {
  const [entitiesInNote, setEntitiesInNote] = useState<EntityInNote[]>([]);
  const [notesWithEntity, setNotesWithEntity] = useState<NoteWithEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      if (options.noteId) {
        const entities = await bidirectionalLinkEngine.getEntitiesInNote(options.noteId);
        setEntitiesInNote(entities);
      }

      if (options.entityId) {
        const notes = await bidirectionalLinkEngine.getNotesWithEntity(options.entityId);
        setNotesWithEntity(notes);
      }
    } catch (error) {
      console.error('[useBidirectionalLinks] Error refreshing:', error);
    } finally {
      setIsLoading(false);
    }
  }, [options.noteId, options.entityId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (options.autoRefresh === false) return;

    const unsubscribe = eventBus.on('linksUpdated', () => {
      refresh();
    });

    return unsubscribe;
  }, [options.autoRefresh, refresh]);

  return {
    entitiesInNote,
    notesWithEntity,
    isLoading,
    refresh,
  };
}
