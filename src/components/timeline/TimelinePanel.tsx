import { useMemo, useEffect, useRef, useState } from 'react';
import { useJotaiNotes } from '@/hooks/useJotaiNotes';
import { useTemporalHighlight } from '@/contexts/TemporalHighlightContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Calendar, Sparkles, SlidersHorizontal, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TimelineQueryEngine, TimelineQuery, TimelineItem } from '@/lib/timeline/timelineQueries';
import { TimelineViewMode, TimelineViewModeSelector } from './TimelineViewModeSelector';
import { TimelineContent } from './TimelineContent';
import { NarrativeEntity } from '@/types/narrativeEntities';
import { EntityKind } from '@/lib/entities/entityTypes';
import { generateId } from '@/lib/utils/ids';

export function TimelinePanel() {
  const { selectedNote, createNote, state, selectNote } = useJotaiNotes();
  const { highlightedTemporal, clearHighlight } = useTemporalHighlight();
  const highlightRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<TimelineViewMode>('cards');
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState<TimelineQuery | null>(null);

  // 1. Get all entities from store (flattened)
  // In a real app with database, we'd query via ID. Here we aggregate from note connections.
  const allEntities = useMemo(() => {
    // Map all connections from all notes to NarrativeEntity-like objects
    // This is a simplified "Entity Store" derived from notes
    const entities: NarrativeEntity[] = [];

    state.notes.forEach(note => {
      if (note.connections?.entities) {
        note.connections.entities.forEach((ref, idx) => {
          // Convert ref to NarrativeEntity
          const entity: any = {
            id: ref.noteId || `${note.id}-entity-${idx}`,
            kind: ref.kind,
            label: ref.label,
            sourceNoteId: note.id,
            // Synthesize temporal data if missing (mock for now)
            temporal: {
              start: {
                timestamp: new Date(), // Mock date
                granularity: 'precise',
                confidence: 1
              }
            },
            // Add minimal metadata to satisfy interface
            narrativeMetadata: { status: 'drafting' },
            sceneMetadata: ref.kind === 'SCENE' ? { location: 'Unknown', purpose: 'setup' } : undefined,
            eventMetadata: ref.kind === 'EVENT' ? { impact: 'minor' } : undefined,
          };
          entities.push(entity as NarrativeEntity);
        });
      }
    });
    return entities;
  }, [state.notes]);

  // 2. Identify Current Context Layer
  // What are we looking at? A character note? An Arc note? Or just general?
  const contextEntity = useMemo(() => {
    if (!selectedNote) return null;
    if (selectedNote.isEntity && selectedNote.entityKind) {
      return {
        id: selectedNote.id,
        kind: selectedNote.entityKind,
        label: selectedNote.title, // or parsed label
      };
    }
    return null;
  }, [selectedNote]);

  // 3. Initialize/Update Query based on Context
  useEffect(() => {
    const newQuery = TimelineQueryEngine.fromContext(
      contextEntity?.kind as EntityKind,
      contextEntity?.id
    );
    setQuery(newQuery);
  }, [contextEntity]);

  // 4. Execute Query
  const timelineItems = useMemo(() => {
    if (!query) return [];
    return TimelineQueryEngine.execute(query, allEntities);
  }, [query, allEntities]);

  // Handlers
  const handleItemClick = (entityId: string) => {
    // In our mock store, entityId might be a noteId or generated.
    // We stored sourceNoteId in the entity.
    const item = timelineItems.find(i => i.id === entityId);
    if (item && item.entity.sourceNoteId) {
      selectNote(item.entity.sourceNoteId);
    }
  };

  const handleQuickAdd = (parentId: string, type: string) => {
    console.log('Quick add:', type, 'to', parentId);
    // Logic to create a new note with link to parent
  };

  if (!selectedNote) {
    // Empty state / Master timeline prompt
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
        <Clock className="mb-4 h-12 w-12 opacity-20" />
        <p className="text-sm">Select a note to view context timeline</p>
        <p className="text-xs mt-2 opacity-60">or explore the master timeline</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Header */}
      <div className="border-b bg-muted/20 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              {contextEntity ? (
                <>
                  <Badge variant="outline" className="text-[10px] h-5 rounded-sm px-1">
                    {contextEntity.kind}
                  </Badge>
                  <span className="truncate">{contextEntity.label}</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Timeline</span>
                </>
              )}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {timelineItems.length} items found
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <TimelineViewModeSelector mode={viewMode} onModeChange={setViewMode} />

          {query && (
            <Select
              value={query.sortBy}
              onValueChange={(v: any) => setQuery({ ...query, sortBy: v })}
            >
              <SelectTrigger className="h-7 w-[90px] text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="temporal">Time</SelectItem>
                <SelectItem value="narrative">Sequence</SelectItem>
                <SelectItem value="importance">Impact</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Filters Area (Collapsible) */}
      {showFilters && (
        <div className="p-3 border-b bg-muted/30 text-xs">
          Filters placeholder (Status, Impact, Date Range)
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        {timelineItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No timeline items</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              Entities linked to this note with temporal tags will appear here.
            </p>
            {contextEntity && (
              <Button size="sm" variant="outline" className="mt-4 h-7 text-xs" onClick={() => handleQuickAdd(contextEntity.id, 'SCENE')}>
                <Plus className="h-3 w-3 mr-1.5" />
                Add Scene
              </Button>
            )}
          </div>
        ) : (
          query && (
            <TimelineContent
              items={timelineItems}
              viewMode={viewMode}
              query={query}
              onNavigate={handleItemClick}
              onEdit={() => { }}
              onQuickAdd={handleQuickAdd}
            />
          )
        )}
      </ScrollArea>

      {/* Footer Stats */}
      <div className="border-t p-2 text-[10px] text-center text-muted-foreground bg-muted/10">
        Timeline Context: {query?.contextType}
      </div>
    </div>
  );
}
