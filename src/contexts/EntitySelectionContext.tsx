/**
 * EntitySelectionContext - Entity selection state for components
 * 
 * Now connected to the global Narrative Focus atom for entity-scoped views.
 * When an entity is selected here, it also updates the narrative focus.
 */

import React, { createContext, useContext, useCallback, ReactNode, useMemo, startTransition } from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { ParsedEntity } from '@/types/factSheetTypes';
import {
  narrativeFocusAtom,
  setNarrativeFocusAtom,
  clearNarrativeFocusAtom,
  focusModeAtom,
} from '@/atoms';
import type { EntityKind } from '@/lib/types/entityTypes';

interface EntitySelectionContextType {
  // Selected entity for fact sheet editing
  selectedEntity: ParsedEntity | null;
  setSelectedEntity: (entity: ParsedEntity | null) => void;

  // Entities available in the current context
  entitiesInCurrentNote: ParsedEntity[];
  setEntitiesInCurrentNote: (entities: ParsedEntity[]) => void;

  // Clear selection
  clearSelection: () => void;

  // Global focus state (from atoms)
  isGlobalFocusActive: boolean;
  globalFocusEntityId: string | null;
  globalFocusEntityLabel: string | null;

  // Set global focus (affects calendar, file creation, etc.)
  setGlobalEntityFocus: (entity: ParsedEntity) => void;
  clearGlobalFocus: () => void;
}

const EntitySelectionContext = createContext<EntitySelectionContextType | undefined>(undefined);

interface EntitySelectionProviderProps {
  children: ReactNode;
}

export function EntitySelectionProvider({ children }: EntitySelectionProviderProps) {
  // Local state for fact sheet entity selection (backward compatible)
  const [localSelectedEntity, setLocalSelectedEntity] = React.useState<ParsedEntity | null>(null);
  const [entitiesInCurrentNote, setEntitiesInCurrentNote] = React.useState<ParsedEntity[]>([]);

  // Global narrative focus state
  const narrativeFocus = useAtomValue(narrativeFocusAtom);
  const focusMode = useAtomValue(focusModeAtom);
  const setNarrativeFocus = useSetAtom(setNarrativeFocusAtom);
  const clearNarrativeFocus = useSetAtom(clearNarrativeFocusAtom);

  // When setting selected entity, wrap in startTransition to allow async atom suspension
  const setSelectedEntity = useCallback((entity: ParsedEntity | null) => {
    // Use startTransition to prevent "suspended during synchronous input" errors
    // when async atoms (entityAttributesFamily, etc.) suspend on entity change
    startTransition(() => {
      setLocalSelectedEntity(entity);
    });
    // Note: We don't auto-update global focus here to maintain backward compatibility
    // Components explicitly call setGlobalEntityFocus when they want global filtering
  }, []);

  const clearSelection = useCallback(() => {
    startTransition(() => {
      setLocalSelectedEntity(null);
      setEntitiesInCurrentNote([]);
    });
  }, []);

  // Set global entity focus (affects calendar, file creation, etc.)
  const setGlobalEntityFocus = useCallback((entity: ParsedEntity) => {
    // Map ParsedEntity to NarrativeFocus format
    setNarrativeFocus({
      entityId: entity.noteId || `${entity.kind}|${entity.label}`,
      entityKind: entity.kind as EntityKind,
      entityLabel: entity.label,
      sourceNoteId: entity.noteId,
    });
  }, [setNarrativeFocus]);

  const clearGlobalFocus = useCallback(() => {
    clearNarrativeFocus();
  }, [clearNarrativeFocus]);

  const value = useMemo(() => ({
    selectedEntity: localSelectedEntity,
    setSelectedEntity,
    entitiesInCurrentNote,
    setEntitiesInCurrentNote,
    clearSelection,
    // Global focus state
    isGlobalFocusActive: focusMode === 'entity' && narrativeFocus.entityId !== null,
    globalFocusEntityId: narrativeFocus.entityId,
    globalFocusEntityLabel: narrativeFocus.entityLabel,
    setGlobalEntityFocus,
    clearGlobalFocus,
  }), [
    localSelectedEntity,
    setSelectedEntity,
    entitiesInCurrentNote,
    clearSelection,
    focusMode,
    narrativeFocus.entityId,
    narrativeFocus.entityLabel,
    setGlobalEntityFocus,
    clearGlobalFocus,
  ]);

  return (
    <EntitySelectionContext.Provider value={value}>
      {children}
    </EntitySelectionContext.Provider>
  );
}

export function useEntitySelection() {
  const context = useContext(EntitySelectionContext);
  if (context === undefined) {
    throw new Error('useEntitySelection must be used within an EntitySelectionProvider');
  }
  return context;
}

/**
 * Safe version of useEntitySelection that returns null when outside provider.
 * Use this in components that may be rendered outside the EntitySelectionProvider.
 */
export function useEntitySelectionSafe(): EntitySelectionContextType | null {
  const context = useContext(EntitySelectionContext);
  return context ?? null;
}
