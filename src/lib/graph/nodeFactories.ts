import { ENTITY_COLORS } from '@/lib/entities/entityTypes';
import type {
  UnifiedNodeData,
  NodeId,
  EntityKind,
  NarrativeEntityKind,
  FolderOptions,
  NoteOptions,
  EntityOptions,
  BlueprintData,
  TemporalData,
  NarrativeMetadata,
  SceneMetadata,
  EventMetadata,
} from './types';

export type NodeDataInput = Omit<UnifiedNodeData, 'id' | 'createdAt' | 'updatedAt'>;

export function createFolderNode(
  label: string,
  options?: FolderOptions
): NodeDataInput {
  return {
    type: 'FOLDER',
    label,
    parentId: options?.parentId,
    depth: 0,
    entityKind: options?.entityKind,
    entitySubtype: options?.entitySubtype,
    isTypedRoot: options?.isTypedRoot,
    isSubtypeRoot: options?.isSubtypeRoot,
    color: options?.color || '#4f46e5',
  };
}

export function createNoteNode(
  label: string,
  content: string,
  options?: NoteOptions
): NodeDataInput {
  return {
    type: 'NOTE',
    label,
    content,
    parentId: options?.parentId,
    entityKind: options?.entityKind,
    entitySubtype: options?.entitySubtype,
    blueprintId: options?.blueprintId,
    tags: options?.tags || [],
    isEntity: options?.isEntity,
    attributes: options?.attributes,
    color: '#06b6d4',
  };
}

export function createEntityNode(
  label: string,
  kind: EntityKind,
  options?: EntityOptions
): NodeDataInput {
  const color = ENTITY_COLORS[kind] || '#6b7280';
  const size = options?.extraction 
    ? Math.min(10 + Math.log(options.extraction.frequency + 1) * 5, 30)
    : 10;

  return {
    type: 'ENTITY',
    label,
    entityKind: kind,
    entitySubtype: options?.entitySubtype,
    isEntity: true,
    sourceNoteId: options?.sourceNoteId,
    blueprintId: options?.blueprintId,
    attributes: options?.attributes,
    extraction: options?.extraction,
    temporal: options?.temporal,
    narrativeMetadata: options?.narrativeMetadata,
    sceneMetadata: options?.sceneMetadata,
    eventMetadata: options?.eventMetadata,
    color,
    size,
  };
}

export function createBlueprintNode(
  label: string,
  data: BlueprintData
): NodeDataInput {
  return {
    type: 'BLUEPRINT',
    label,
    blueprintData: data,
    entityKind: data.entityKind,
    color: '#fbbf24',
    shape: 'roundrectangle',
  };
}

export function createTemporalNode(
  label: string,
  temporal: TemporalData
): NodeDataInput {
  return {
    type: 'TEMPORAL',
    label,
    temporal,
    color: '#eab308',
    shape: 'diamond',
  };
}

export function createNarrativeNode(
  label: string,
  kind: NarrativeEntityKind,
  metadata?: NarrativeMetadata
): NodeDataInput {
  const color = ENTITY_COLORS[kind] || '#8b5cf6';
  
  const defaults: Partial<NarrativeMetadata> = {
    status: 'planning',
    sequence: 0,
  };

  return {
    type: 'ENTITY',
    label,
    entityKind: kind,
    isEntity: true,
    narrativeMetadata: { ...defaults, ...metadata },
    color,
  };
}

export function createSceneNode(
  label: string,
  sceneMetadata: SceneMetadata,
  narrativeMetadata?: NarrativeMetadata,
  temporal?: TemporalData
): NodeDataInput {
  return {
    type: 'ENTITY',
    label,
    entityKind: 'SCENE',
    isEntity: true,
    sceneMetadata,
    narrativeMetadata: {
      status: 'planning',
      sequence: 0,
      ...narrativeMetadata,
    },
    temporal,
    color: ENTITY_COLORS.SCENE,
  };
}

export function createEventNode(
  label: string,
  eventMetadata: EventMetadata,
  narrativeMetadata?: NarrativeMetadata,
  temporal?: TemporalData
): NodeDataInput {
  return {
    type: 'ENTITY',
    label,
    entityKind: 'EVENT',
    isEntity: true,
    eventMetadata,
    narrativeMetadata: {
      status: 'planning',
      sequence: 0,
      ...narrativeMetadata,
    },
    temporal,
    color: ENTITY_COLORS.EVENT,
  };
}

export function createCharacterNode(
  label: string,
  subtype?: string,
  attributes?: Record<string, unknown>
): NodeDataInput {
  return createEntityNode(label, 'CHARACTER', {
    entitySubtype: subtype,
    attributes,
  });
}

export function createLocationNode(
  label: string,
  subtype?: string,
  attributes?: Record<string, unknown>
): NodeDataInput {
  return createEntityNode(label, 'LOCATION', {
    entitySubtype: subtype,
    attributes,
  });
}

export function createItemNode(
  label: string,
  subtype?: string,
  attributes?: Record<string, unknown>
): NodeDataInput {
  return createEntityNode(label, 'ITEM', {
    entitySubtype: subtype,
    attributes,
  });
}

export function createFactionNode(
  label: string,
  subtype?: string,
  attributes?: Record<string, unknown>
): NodeDataInput {
  return createEntityNode(label, 'FACTION', {
    entitySubtype: subtype,
    attributes,
  });
}
