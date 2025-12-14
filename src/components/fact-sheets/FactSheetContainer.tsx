import React, { useMemo, useEffect } from 'react';
import { useNotes } from '@/contexts/NotesContext';
import { useEntitySelection } from '@/contexts/EntitySelectionContext';
import { parseNoteConnectionsFromDocument } from '@/lib/entities/documentParser';
import { getSchemaForEntityKind } from '@/lib/entity-schemas';
import type { ParsedEntity } from '@/types/factSheetTypes';
import type { EntityKind } from '@/lib/entities/entityTypes';
import { FileQuestion, Sparkles } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Placeholder fact sheet components until Phase 4
function PlaceholderFactSheet({ entity }: { entity: ParsedEntity }) {
  const schema = getSchemaForEntityKind(entity.kind);
  
  return (
    <div className="p-4 space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">{entity.kind} Fact Sheet</span>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          Entity: <span className="text-foreground font-medium">{entity.label}</span>
        </p>
        {entity.subtype && (
          <p className="text-sm text-muted-foreground mb-2">
            Subtype: <span className="text-foreground">{entity.subtype}</span>
          </p>
        )}
        {schema && (
          <p className="text-xs text-muted-foreground">
            Schema loaded: {schema.cards.length} cards defined
          </p>
        )}
      </div>
      
      {/* Show card previews */}
      {schema?.cards.map((card) => (
        <div
          key={card.id}
          className="rounded-lg border border-border bg-card/50 p-3"
        >
          <div className="flex items-center gap-2 text-sm">
            <div 
              className={`w-2 h-2 rounded-full bg-gradient-to-r ${card.gradient}`} 
            />
            <span className="text-muted-foreground">{card.title}</span>
            <span className="text-xs text-muted-foreground/60 ml-auto">
              {card.fields.length} fields
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FactSheetContainer() {
  const { selectedNote } = useNotes();
  const { 
    selectedEntity, 
    setSelectedEntity, 
    entitiesInCurrentNote, 
    setEntitiesInCurrentNote 
  } = useEntitySelection();

  // Parse entities from note content and note itself
  const allEntities = useMemo(() => {
    const entities: ParsedEntity[] = [];

    // Check if note itself is an entity
    if (selectedNote?.isEntity && selectedNote.entityKind && selectedNote.entityLabel) {
      entities.push({
        kind: selectedNote.entityKind,
        subtype: selectedNote.entitySubtype,
        label: selectedNote.entityLabel,
        noteId: selectedNote.id,
        attributes: {},
      });
    }

    // Parse inline entities from content
    if (selectedNote?.content) {
      try {
        const parsed = JSON.parse(selectedNote.content);
        const connections = parseNoteConnectionsFromDocument(parsed);
        
        for (const entity of connections.entities) {
          // Avoid duplicates (note entity already added)
          const isDuplicate = entities.some(
            e => e.kind === entity.kind && e.label === entity.label
          );
          if (!isDuplicate) {
            entities.push({
              kind: entity.kind as EntityKind,
              subtype: entity.subtype,
              label: entity.label,
              attributes: entity.attributes || {},
            });
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    }

    return entities;
  }, [selectedNote?.content, selectedNote?.isEntity, selectedNote?.entityKind, selectedNote?.entityLabel, selectedNote?.entitySubtype, selectedNote?.id]);

  // Update context when entities change
  useEffect(() => {
    setEntitiesInCurrentNote(allEntities);
    
    // Auto-select first entity if none selected or current selection not in list
    if (allEntities.length > 0) {
      const currentStillValid = selectedEntity && allEntities.some(
        e => e.kind === selectedEntity.kind && e.label === selectedEntity.label
      );
      if (!currentStillValid) {
        setSelectedEntity(allEntities[0]);
      }
    } else {
      setSelectedEntity(null);
    }
  }, [allEntities, selectedEntity, setSelectedEntity, setEntitiesInCurrentNote]);

  // No note selected
  if (!selectedNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <FileQuestion className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">
          Select a note to view entity details
        </p>
      </div>
    );
  }

  // No entities found
  if (allEntities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          No entities in this note
        </p>
        <p className="text-xs text-muted-foreground/70 max-w-[280px]">
          Add entities using syntax like <code className="bg-muted px-1 rounded">[CHARACTER|Name]</code> or create an entity note
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Entity selector (shown when multiple entities) */}
      {allEntities.length > 1 && (
        <div className="p-3 border-b border-border">
          <Select
            value={selectedEntity ? `${selectedEntity.kind}|${selectedEntity.label}` : ''}
            onValueChange={(value) => {
              const [kind, ...labelParts] = value.split('|');
              const label = labelParts.join('|');
              const entity = allEntities.find(e => e.kind === kind && e.label === label);
              if (entity) setSelectedEntity(entity);
            }}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Select entity" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border">
              {allEntities.map((entity) => (
                <SelectItem 
                  key={`${entity.kind}|${entity.label}`} 
                  value={`${entity.kind}|${entity.label}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      {entity.kind}
                    </span>
                    <span>{entity.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Fact sheet content */}
      <div className="flex-1 overflow-auto">
        {selectedEntity && <PlaceholderFactSheet entity={selectedEntity} />}
      </div>
    </div>
  );
}
