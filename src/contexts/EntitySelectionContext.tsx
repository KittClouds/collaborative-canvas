import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ParsedEntity } from '@/types/factSheetTypes';

interface EntitySelectionContextType {
  selectedEntity: ParsedEntity | null;
  setSelectedEntity: (entity: ParsedEntity | null) => void;
  entitiesInCurrentNote: ParsedEntity[];
  setEntitiesInCurrentNote: (entities: ParsedEntity[]) => void;
  clearSelection: () => void;
}

const EntitySelectionContext = createContext<EntitySelectionContextType | undefined>(undefined);

interface EntitySelectionProviderProps {
  children: ReactNode;
}

export function EntitySelectionProvider({ children }: EntitySelectionProviderProps) {
  const [selectedEntity, setSelectedEntity] = useState<ParsedEntity | null>(null);
  const [entitiesInCurrentNote, setEntitiesInCurrentNote] = useState<ParsedEntity[]>([]);

  const clearSelection = useCallback(() => {
    setSelectedEntity(null);
    setEntitiesInCurrentNote([]);
  }, []);

  return (
    <EntitySelectionContext.Provider
      value={{
        selectedEntity,
        setSelectedEntity,
        entitiesInCurrentNote,
        setEntitiesInCurrentNote,
        clearSelection,
      }}
    >
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
