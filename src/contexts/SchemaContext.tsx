import React, { createContext, useContext, useState, useEffect } from 'react';
import { EntityType, RelationshipType } from '@/types/schema';
import { EntityBlueprint } from '@/types/blueprints';
import { ENTITY_KINDS, ENTITY_COLORS } from '@/lib/types/entityTypes';

// Default entity types based on existing system
const DEFAULT_ENTITY_TYPES: EntityType[] = ENTITY_KINDS.map(kind => ({
  kind,
  labelProp: 'title',
  defaultStyle: {
    shape: 'rectangle' as const,
    color: ENTITY_COLORS[kind] || '#7C5BF1',
  },
}));

// Default relationship types
const DEFAULT_RELATIONSHIP_TYPES: RelationshipType[] = [
  { label: 'HAS_TAG', from: 'NOTE', to: 'TAG', directed: true },
  { label: 'MENTIONS', from: 'NOTE', to: 'MENTION', directed: true },
  { label: 'CONTAINS', from: 'FOLDER', to: ['NOTE', 'FOLDER'], directed: true },
  { label: 'LINKS_TO', from: 'NOTE', to: 'NOTE', directed: true },
  { label: 'REFERS_TO', from: 'NOTE', to: '*', directed: true },
];

interface SchemaContextType {
  entityTypes: EntityType[];
  relationshipTypes: RelationshipType[];
  blueprints: EntityBlueprint[];
  getEntityTypes: () => EntityType[];
  getRelationshipTypes: () => RelationshipType[];
  registerEntityType: (kind: string, labelProp: string, style?: EntityType['defaultStyle']) => void;
  updateEntityType: (kind: string, updates: Partial<EntityType>) => void;
  deleteEntityType: (kind: string) => void;
  registerRelationshipType: (label: string, from: string | string[], to: string | string[], directed: boolean, style?: RelationshipType['defaultStyle']) => void;
  updateRelationshipType: (label: string, updates: Partial<RelationshipType>) => void;
  deleteRelationshipType: (label: string) => void;
  createBlueprint: (blueprint: EntityBlueprint) => void;
  updateBlueprint: (blueprint: EntityBlueprint) => void;
  deleteBlueprint: (id: string) => void;
}

const SchemaContext = createContext<SchemaContextType | undefined>(undefined);

export function SchemaProvider({ children }: { children: React.ReactNode }) {
  const [entityTypes, setEntityTypes] = useState<EntityType[]>(() => {
    const saved = localStorage.getItem('canvas-entity-types');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_ENTITY_TYPES;
      }
    }
    return DEFAULT_ENTITY_TYPES;
  });

  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>(() => {
    const saved = localStorage.getItem('canvas-relationship-types');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_RELATIONSHIP_TYPES;
      }
    }
    return DEFAULT_RELATIONSHIP_TYPES;
  });

  const [blueprints, setBlueprints] = useState<EntityBlueprint[]>(() => {
    const saved = localStorage.getItem('canvas-blueprints');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('canvas-entity-types', JSON.stringify(entityTypes));
  }, [entityTypes]);

  useEffect(() => {
    localStorage.setItem('canvas-relationship-types', JSON.stringify(relationshipTypes));
  }, [relationshipTypes]);

  useEffect(() => {
    localStorage.setItem('canvas-blueprints', JSON.stringify(blueprints));
  }, [blueprints]);

  const getEntityTypes = () => entityTypes;
  const getRelationshipTypes = () => relationshipTypes;

  const registerEntityType = (kind: string, labelProp: string, style?: EntityType['defaultStyle']) => {
    const exists = entityTypes.find(e => e.kind === kind);
    if (exists) {
      throw new Error(`Entity type ${kind} already exists`);
    }
    setEntityTypes([...entityTypes, { kind, labelProp, defaultStyle: style }]);
  };

  const updateEntityType = (kind: string, updates: Partial<EntityType>) => {
    setEntityTypes(entityTypes.map(e => e.kind === kind ? { ...e, ...updates } : e));
  };

  const deleteEntityType = (kind: string) => {
    // Prevent deleting core types
    if (ENTITY_KINDS.includes(kind as any)) {
      throw new Error(`Cannot delete core entity type ${kind}`);
    }
    setEntityTypes(entityTypes.filter(e => e.kind !== kind));
  };

  const registerRelationshipType = (label: string, from: string | string[], to: string | string[], directed: boolean, style?: RelationshipType['defaultStyle']) => {
    const exists = relationshipTypes.find(r => r.label === label);
    if (exists) {
      throw new Error(`Relationship type ${label} already exists`);
    }
    setRelationshipTypes([...relationshipTypes, { label, from, to, directed, defaultStyle: style }]);
  };

  const updateRelationshipType = (label: string, updates: Partial<RelationshipType>) => {
    setRelationshipTypes(relationshipTypes.map(r => r.label === label ? { ...r, ...updates } : r));
  };

  const deleteRelationshipType = (label: string) => {
    setRelationshipTypes(relationshipTypes.filter(r => r.label !== label));
  };

  const createBlueprint = (blueprint: EntityBlueprint) => {
    setBlueprints([...blueprints, blueprint]);
  };

  const updateBlueprint = (blueprint: EntityBlueprint) => {
    setBlueprints(blueprints.map(b => b.id === blueprint.id ? blueprint : b));
  };

  const deleteBlueprint = (id: string) => {
    setBlueprints(blueprints.filter(b => b.id !== id));
  };

  return (
    <SchemaContext.Provider value={{
      entityTypes,
      relationshipTypes,
      blueprints,
      getEntityTypes,
      getRelationshipTypes,
      registerEntityType,
      updateEntityType,
      deleteEntityType,
      registerRelationshipType,
      updateRelationshipType,
      deleteRelationshipType,
      createBlueprint,
      updateBlueprint,
      deleteBlueprint
    }}>
      {children}
    </SchemaContext.Provider>
  );
}

export function useSchema() {
  const context = useContext(SchemaContext);
  if (!context) {
    throw new Error('useSchema must be used within SchemaProvider');
  }
  return context;
}
