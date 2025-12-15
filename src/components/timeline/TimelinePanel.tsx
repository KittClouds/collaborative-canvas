import { useMemo } from 'react';
import { useNotes } from '@/contexts/NotesContext';
import { StoryTimeline } from './StoryTimeline';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Calendar } from 'lucide-react';
import type { SceneEntity, EventEntity } from '@/types/storyEntities';

export function TimelinePanel() {
  const { selectedNote, state } = useNotes();
  
  // Extract scene and event entities from the current note's connections
  const { scenes, events, entities } = useMemo(() => {
    if (!selectedNote?.connections) {
      return { scenes: [], events: [], entities: [] };
    }
    
    const allEntities = selectedNote.connections.entities || [];
    
    // Convert entity references to SceneEntity/EventEntity format
    const scenes: SceneEntity[] = allEntities
      .filter(e => e.kind === 'SCENE')
      .map((e, idx) => ({
        id: e.noteId || `scene-${idx}`,
        kind: 'SCENE' as const,
        label: e.label,
        subtype: e.subtype,
        temporal: {
          start: {
            id: `temporal-${idx}`,
            granularity: 'sequential' as const,
            sequence: idx + 1,
            displayText: `Scene ${idx + 1}`,
            confidence: 1,
            source: 'inferred' as const,
          }
        },
        events: [],
        participants: [],
        cardTitle: e.label,
      }));
    
    const events: EventEntity[] = allEntities
      .filter(e => e.kind === 'EVENT')
      .map((e, idx) => ({
        id: e.noteId || `event-${idx}`,
        kind: 'EVENT' as const,
        label: e.label,
        subtype: e.subtype,
        temporal: {
          start: {
            id: `temporal-event-${idx}`,
            granularity: 'sequential' as const,
            sequence: idx + 1,
            displayText: `Event ${idx + 1}`,
            confidence: 1,
            source: 'inferred' as const,
          }
        },
        actors: [],
        affectedEntities: [],
        importance: 'major' as const,
        tags: [],
        cardTitle: e.label,
      }));
    
    return { scenes, events, entities: allEntities };
  }, [selectedNote]);
  
  // Handle clicking on timeline items
  const handleItemClick = (entityId: string, entityKind: string) => {
    console.log('Timeline item clicked:', entityId, entityKind);
  };
  
  if (!selectedNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground">
          Select a note to view its timeline
        </p>
      </div>
    );
  }
  
  if (scenes.length === 0 && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          No timeline events found
        </p>
        <p className="text-xs text-muted-foreground/70">
          Add [SCENE|Name] or [EVENT|Name] syntax to see them here
        </p>
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <StoryTimeline
          scenes={scenes}
          events={events}
          entities={entities}
          onItemClick={handleItemClick}
        />
      </div>
    </ScrollArea>
  );
}
