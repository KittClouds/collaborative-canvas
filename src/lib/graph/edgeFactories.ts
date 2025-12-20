import type {
  UnifiedEdgeData,
  NodeId,
  EdgeType,
  ExtractionMethod,
  TemporalRelation,
  CausalityData,
} from './types';

export type EdgeDataInput = Omit<UnifiedEdgeData, 'id' | 'createdAt'>;

export function createContainsEdge(
  parentId: NodeId,
  childId: NodeId
): EdgeDataInput {
  return {
    source: parentId,
    target: childId,
    type: 'CONTAINS',
    bidirectional: false,
  };
}

export function createParentOfEdge(
  parentId: NodeId,
  childId: NodeId
): EdgeDataInput {
  return {
    source: parentId,
    target: childId,
    type: 'PARENT_OF',
    bidirectional: false,
  };
}

export function createBacklinkEdge(
  sourceId: NodeId,
  targetId: NodeId
): EdgeDataInput {
  return {
    source: sourceId,
    target: targetId,
    type: 'BACKLINK',
    bidirectional: true,
  };
}

export function createMentionEdge(
  noteId: NodeId,
  entityId: NodeId,
  context: string,
  confidence: number = 1.0,
  extractionMethod: ExtractionMethod = 'regex'
): EdgeDataInput {
  return {
    source: noteId,
    target: entityId,
    type: 'MENTIONS',
    context,
    confidence,
    extractionMethod,
    noteIds: [noteId],
  };
}

export function createReferenceEdge(
  sourceId: NodeId,
  targetId: NodeId,
  context?: string
): EdgeDataInput {
  return {
    source: sourceId,
    target: targetId,
    type: 'REFERENCES',
    context,
    bidirectional: false,
  };
}

export function createCoOccurrenceEdge(
  entityA: NodeId,
  entityB: NodeId,
  weight: number,
  noteIds: NodeId[]
): EdgeDataInput {
  return {
    source: entityA,
    target: entityB,
    type: 'CO_OCCURS',
    weight,
    noteIds,
    confidence: 1.0,
  };
}

export function createKnowsEdge(
  characterA: NodeId,
  characterB: NodeId,
  properties?: Record<string, unknown>
): EdgeDataInput {
  return {
    source: characterA,
    target: characterB,
    type: 'KNOWS',
    bidirectional: true,
    properties,
  };
}

export function createLocatedInEdge(
  entityId: NodeId,
  locationId: NodeId
): EdgeDataInput {
  return {
    source: entityId,
    target: locationId,
    type: 'LOCATED_IN',
    bidirectional: false,
  };
}

export function createOwnsEdge(
  ownerId: NodeId,
  itemId: NodeId
): EdgeDataInput {
  return {
    source: ownerId,
    target: itemId,
    type: 'OWNS',
    bidirectional: false,
  };
}

export function createMemberOfEdge(
  memberId: NodeId,
  factionId: NodeId
): EdgeDataInput {
  return {
    source: memberId,
    target: factionId,
    type: 'MEMBER_OF',
    bidirectional: false,
  };
}

export function createRelatedToEdge(
  sourceId: NodeId,
  targetId: NodeId,
  properties?: Record<string, unknown>
): EdgeDataInput {
  return {
    source: sourceId,
    target: targetId,
    type: 'RELATED_TO',
    bidirectional: true,
    properties,
  };
}

export function createDerivedFromEdge(
  derivedId: NodeId,
  sourceId: NodeId
): EdgeDataInput {
  return {
    source: derivedId,
    target: sourceId,
    type: 'DERIVED_FROM',
    bidirectional: false,
  };
}

export function createInstanceOfEdge(
  instanceId: NodeId,
  blueprintId: NodeId
): EdgeDataInput {
  return {
    source: instanceId,
    target: blueprintId,
    type: 'INSTANCE_OF',
    bidirectional: false,
  };
}

export function createConformsToEdge(
  entityId: NodeId,
  blueprintId: NodeId
): EdgeDataInput {
  return {
    source: entityId,
    target: blueprintId,
    type: 'CONFORMS_TO',
    bidirectional: false,
  };
}

export function createTemporalEdge(
  sourceId: NodeId,
  targetId: NodeId,
  relation: TemporalRelation
): EdgeDataInput {
  const typeMap: Record<TemporalRelation['relationType'], EdgeType> = {
    before: 'BEFORE',
    after: 'AFTER',
    during: 'DURING',
    overlaps: 'DURING',
  };

  return {
    source: sourceId,
    target: targetId,
    type: typeMap[relation.relationType],
    temporalRelation: relation,
    bidirectional: false,
  };
}

export function createBeforeEdge(
  earlierId: NodeId,
  laterId: NodeId,
  gap?: TemporalRelation['gap']
): EdgeDataInput {
  return createTemporalEdge(earlierId, laterId, {
    relationType: 'before',
    gap,
  });
}

export function createAfterEdge(
  laterId: NodeId,
  earlierId: NodeId,
  gap?: TemporalRelation['gap']
): EdgeDataInput {
  return createTemporalEdge(laterId, earlierId, {
    relationType: 'after',
    gap,
  });
}

export function createDuringEdge(
  containedId: NodeId,
  containerId: NodeId
): EdgeDataInput {
  return createTemporalEdge(containedId, containerId, {
    relationType: 'during',
  });
}

export function createCausalEdge(
  causeId: NodeId,
  effectId: NodeId,
  causality: CausalityData
): EdgeDataInput {
  return {
    source: causeId,
    target: effectId,
    type: 'CAUSED_BY',
    causality,
    bidirectional: false,
  };
}

export function createLeadsToEdge(
  sourceId: NodeId,
  targetId: NodeId,
  causality?: CausalityData
): EdgeDataInput {
  return {
    source: sourceId,
    target: targetId,
    type: 'LEADS_TO',
    causality,
    bidirectional: false,
  };
}

export function createCustomEdge(
  sourceId: NodeId,
  targetId: NodeId,
  type: string,
  options?: {
    weight?: number;
    confidence?: number;
    bidirectional?: boolean;
    properties?: Record<string, unknown>;
  }
): EdgeDataInput {
  return {
    source: sourceId,
    target: targetId,
    type,
    weight: options?.weight,
    confidence: options?.confidence,
    bidirectional: options?.bidirectional,
    properties: options?.properties,
  };
}
