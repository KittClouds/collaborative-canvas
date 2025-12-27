import React, { useMemo, useEffect, useCallback, useState } from 'react';
import { useJotaiNotes } from '@/hooks/useJotaiNotes';
import { useEntitySelection } from '@/contexts/EntitySelectionContext';
import { parseNoteConnectionsFromDocument } from '@/lib/entities/documentScanner';
import type { ParsedEntity, EntityAttributes } from '@/types/factSheetTypes';
import type { EntityKind } from '@/lib/entities/entityTypes';
import { FileQuestion, Sparkles, BrainCircuit, LayoutGrid, List } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsManager } from '@/lib/settings';
import { ModelRegistry, ModelId } from '@/lib/llm';
import { Button } from '@/components/ui/button';

// Import all fact sheet components
import { CharacterFactSheet } from './CharacterFactSheet';
import { LocationFactSheet } from './LocationFactSheet';
import { ItemFactSheet } from './ItemFactSheet';
import { FactionFactSheet } from './FactionFactSheet';
import { EventFactSheet } from './EventFactSheet';
import { ConceptFactSheet } from './ConceptFactSheet';
import { NPCFactSheet } from './NPCFactSheet';
import { SceneFactSheet } from './SceneFactSheet';
import { BlueprintCardsPanel } from './BlueprintCardsPanel';

// Map entity kinds to their fact sheet components
const factSheetComponents: Partial<Record<EntityKind, React.ComponentType<{ entity: ParsedEntity; onUpdate: (attributes: EntityAttributes) => void }>>> = {
  CHARACTER: CharacterFactSheet,
  LOCATION: LocationFactSheet,
  ITEM: ItemFactSheet,
  FACTION: FactionFactSheet,
  EVENT: EventFactSheet,
  CONCEPT: ConceptFactSheet,
  NPC: NPCFactSheet,
  SCENE: SceneFactSheet,
};

type PanelMode = 'standard' | 'blueprint';

const PANEL_MODE_STORAGE_KEY = 'entities-panel:mode';

function getPanelMode(): PanelMode {
  const stored = localStorage.getItem(PANEL_MODE_STORAGE_KEY);
  return stored === 'blueprint' ? 'blueprint' : 'standard';
}

function setPanelMode(mode: PanelMode) {
  localStorage.setItem(PANEL_MODE_STORAGE_KEY, mode);
}

export function FactSheetContainer() {
  const { selectedNote, updateNoteContent } = useJotaiNotes();
  const {
    selectedEntity,
    setSelectedEntity,
    entitiesInCurrentNote,
    setEntitiesInCurrentNote
  } = useEntitySelection();

  // Panel Mode State
  const [panelMode, setPanelModeState] = useState<PanelMode>(getPanelMode());

  // Extraction Model State (Synced with global settings by default)
  const [extModel, setExtModel] = useState<ModelId>(() => {
    return SettingsManager.getLLMSettings().extractorModel;
  });

  // Sync with global settings changes
  useEffect(() => {
    const settings = SettingsManager.load();
    setExtModel(settings.llm.extractorModel);
  }, [SettingsManager]);

  const handlePanelModeChange = useCallback((mode: PanelMode) => {
    setPanelModeState(mode);
    setPanelMode(mode);
  }, []);

  const handleModelChange = useCallback((modelId: string) => {
    const id = modelId as ModelId;
    setExtModel(id);
    // Optionally update global settings if user changes it here
    SettingsManager.updateLLMSettings({ extractorModel: id });
  }, []);

  // ... (rest of the component)
  const allEntities = useMemo(() => {
    const entities: ParsedEntity[] = [];

    // Check if note itself is an entity
    if (selectedNote?.isEntity && selectedNote.entityKind && selectedNote.entityLabel) {
      entities.push({
        kind: selectedNote.entityKind as EntityKind,
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

  // Handle attribute updates - persist to note content
  const handleAttributeUpdate = useCallback(
    (attributes: EntityAttributes) => {
      if (!selectedNote || !selectedEntity) return;

      // For now, we'll store entity attributes in a special section of the note content
      // In a full implementation, this would update the entity's attributes in the content JSON
      try {
        const content = JSON.parse(selectedNote.content);
        if (!content.entityAttributes) {
          content.entityAttributes = {};
        }
        const entityKey = `${selectedEntity.kind}|${selectedEntity.label}`;
        content.entityAttributes[entityKey] = attributes;
        updateNoteContent(selectedNote.id, JSON.stringify(content));
      } catch {
        // Handle parse error
      }
    },
    [selectedNote, selectedEntity, updateNoteContent]
  );

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

  // Get the correct fact sheet component
  const FactSheetComponent = selectedEntity
    ? factSheetComponents[selectedEntity.kind]
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Extraction Model Selector */}
      <div className="p-2 border-b border-border bg-muted/20 flex items-center gap-2">
        <BrainCircuit className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={extModel} onValueChange={handleModelChange}>
          <SelectTrigger className="h-7 text-xs w-full bg-background">
            <SelectValue placeholder="Select Extraction Model" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Gemini
            </div>
            {ModelRegistry.getModelsByProvider('gemini').map(model => (
              <SelectItem key={model.id} value={model.id} className="text-xs">
                {model.name} {model.costPer1kTokens === 0 && '(FREE)'}
              </SelectItem>
            ))}
            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
              OpenRouter
            </div>
            {ModelRegistry.getModelsByProvider('openrouter').map(model => (
              <SelectItem key={model.id} value={model.id} className="text-xs">
                {model.name} {model.costPer1kTokens === 0 && '(FREE)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Panel Mode Toggle */}
      <div className="p-2 border-b border-border bg-muted/10 flex items-center gap-2 justify-center">
        <div className="inline-flex rounded-md border border-border bg-background p-0.5">
          <Button
            variant={panelMode === 'standard' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => handlePanelModeChange('standard')}
          >
            <List className="h-3 w-3 mr-1.5" />
            Standard
          </Button>
          <Button
            variant={panelMode === 'blueprint' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => handlePanelModeChange('blueprint')}
          >
            <LayoutGrid className="h-3 w-3 mr-1.5" />
            Blueprint
          </Button>
        </div>
      </div>

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
        {selectedEntity && panelMode === 'standard' && FactSheetComponent && (
          <FactSheetComponent
            entity={selectedEntity}
            onUpdate={handleAttributeUpdate}
          />
        )}
        {selectedEntity && panelMode === 'blueprint' && (
          <BlueprintCardsPanel
            entity={selectedEntity}
            onUpdate={handleAttributeUpdate}
          />
        )}
      </div>
    </div>
  );
}
