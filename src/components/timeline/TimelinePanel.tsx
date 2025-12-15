import { useMemo, useEffect, useRef } from 'react';
import { useNotes } from '@/contexts/NotesContext';
import { useTemporalHighlight } from '@/contexts/TemporalHighlightContext';
import { StoryTimeline } from './StoryTimeline';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Calendar, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SceneEntity, EventEntity } from '@/types/storyEntities';
import { cn } from '@/lib/utils';

export function TimelinePanel() {
  const { selectedNote } = useNotes();
  const { highlightedTemporal, clearHighlight } = useTemporalHighlight();
  const highlightRef = useRef<HTMLDivElement>(null);
  
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

  // Scroll to highlight when temporal is clicked
  useEffect(() => {
    if (highlightedTemporal && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [highlightedTemporal]);
  
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

        {/* Show highlighted temporal expression when clicked from editor */}
        {highlightedTemporal && (
          <div 
            ref={highlightRef}
            className="mt-6 p-4 rounded-lg border border-primary/30 bg-primary/5 animate-pulse"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">Temporal Reference</span>
            </div>
            <p className="text-sm font-medium text-foreground">"{highlightedTemporal}"</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a [SCENE|...] or [EVENT|...] to add this to the timeline
            </p>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        {/* Show highlighted temporal expression at the top */}
        {highlightedTemporal && (
          <div 
            ref={highlightRef}
            className={cn(
              "mb-4 p-3 rounded-lg border transition-all duration-300",
              "border-primary/50 bg-primary/10 shadow-sm"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-primary">Temporal Reference</span>
              </div>
              <button 
                onClick={clearHighlight}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="text-sm font-medium text-foreground mt-1">"{highlightedTemporal}"</p>
            <div className="flex gap-1 mt-2 flex-wrap">
              {scenes.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
                </Badge>
              )}
              {events.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {events.length} event{events.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        )}
        
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
