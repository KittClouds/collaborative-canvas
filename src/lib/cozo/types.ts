export type GraphScope = 'note' | 'folder' | 'vault';

export interface ScopeIdentifier {
  scope: GraphScope;
  id: string;
  groupId: string;
}

export function buildScopeIdentifier(scope: GraphScope, id: string): ScopeIdentifier {
  const groupId = scope === 'vault' ? 'vault:global' : `${scope}:${id}`;
  return { scope, id, groupId };
}

export function parseScopeIdentifier(groupId: string): ScopeIdentifier {
  const [scope, id] = groupId.split(':');
  return {
    scope: scope as GraphScope,
    id: id || 'global',
    groupId,
  };
}

/**
 * Graph Extraction Input (received from SQLite backbone)
 */
export interface GraphExtractionInput {
  id: string;
  title: string;
  contentJson: object;
  folderId?: string;
  groupId: string;
}


export interface CozoEpisode {
  id: string;
  noteId: string;
  createdAt: Date;
  validAt: Date;
  // Content removed: Cozo only stores graph metadata
  blockId?: string;

  groupId: string;
  scopeType: GraphScope;
  extractionMethod: 'regex' | 'llm' | 'manual';
  processedAt?: Date;
  sentenceIndex?: number;
  paragraphIndex?: number;
}

/**
 * In-memory episode with content for extraction processing
 */
export interface ExtractionEpisode extends CozoEpisode {
  contentText: string;
  contentJson?: object;
}


export const COZO_ENTITY_KINDS = [
  'CHARACTER',
  'LOCATION',
  'NPC',
  'ITEM',
  'FACTION',
  'SCENE',
  'EVENT',
  'CONCEPT',
  'ARC',
  'ACT',
  'CHAPTER',
  'BEAT',
  'TIMELINE',
  'NARRATIVE',
] as const;

export type CozoEntityKind = typeof COZO_ENTITY_KINDS[number];

export interface CozoEntity {
  id: string;
  name: string;
  entityKind: CozoEntityKind;
  entitySubtype?: string;
  groupId: string;
  scopeType: GraphScope;
  createdAt: Date;
  extractionMethod: 'regex' | 'llm' | 'manual';
  summary?: string;
  aliases: string[];
  canonicalNoteId?: string;
  frequency: number;
  degreeCentrality?: number;
  betweennessCentrality?: number;
  closenessCentrality?: number;
  communityId?: string;
  attributes?: Record<string, unknown>;
  temporalSpan?: CozoTemporalSpan;
  participants: string[];
}

export interface CozoMention {
  id: string;
  episodeId: string;
  entityId: string;
  context: string;
  charPosition: number;
  sentenceIndex?: number;
  confidence: number;
  extractionMethod: 'regex' | 'llm' | 'manual';
  createdAt: Date;
}

export interface CozoEntityEdge {
  id: string;
  sourceId: string;
  targetId: string;
  createdAt: Date;
  validAt: Date;
  invalidAt?: Date;
  groupId: string;
  scopeType: GraphScope;
  edgeType: string;
  fact?: string;
  episodeIds: string[];
  noteIds: string[];
  weight: number;
  pmiScore?: number;
  confidence: number;
  extractionMethods: string[];
}

export interface CozoNarrativeHierarchy {
  id: string;
  parentId: string;
  childId: string;
  parentKind: CozoEntityKind;
  childKind: CozoEntityKind;
  sequenceOrder?: number;
  createdAt: Date;
}

export interface CozoCausalLink {
  id: string;
  triggerEventId: string;
  causedEventId: string;
  causalType: 'triggers' | 'prevents' | 'enables';
  confidence: number;
  createdAt: Date;
}

export type TemporalGranularity =
  | 'precise'
  | 'datetime'
  | 'date'
  | 'relative'
  | 'sequential'
  | 'abstract';

export type TimeOfDay =
  | 'dawn'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'midnight';

export type DurationUnit =
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'days'
  | 'weeks'
  | 'months'
  | 'years';

export type TimeSource =
  | 'explicit'
  | 'inferred'
  | 'contextual'
  | 'manual'
  | 'parsed';

export interface CozoTemporalPoint {
  id: string;
  entityId: string;
  granularity: TemporalGranularity;
  timestamp?: Date;
  relativeToEventId?: string;
  offsetValue?: number;
  offsetUnit?: DurationUnit;
  offsetDirection?: 'before' | 'after';
  chapter?: number;
  act?: number;
  scene?: number;
  sequence?: number;
  timeOfDay?: TimeOfDay;
  displayText: string;
  originalText?: string;
  confidence: number;
  source: TimeSource;
  locked: boolean;
  parsedFromNoteId?: string;
  parsedFromOffset?: number;
}

export interface CozoTemporalSpan {
  start: CozoTemporalPoint;
  end?: CozoTemporalPoint;
  duration?: {
    value: number;
    unit: DurationUnit;
  };
}

export interface CozoCommunity {
  id: string;
  groupId: string;
  scopeType: GraphScope;
  summary?: string;
  memberCount: number;
  topEntities: string[];
  createdAt: Date;
  computedAt?: Date;
}

export interface CozoCommunityMember {
  communityId: string;
  entityId: string;
  membershipScore?: number;
  addedAt: Date;
}

export interface CozoGraphStats {
  id: string;
  scopeType: GraphScope;
  scopeId: string;
  groupId: string;
  entityCount: number;
  edgeCount: number;
  episodeCount: number;
  avgDegree: number;
  density: number;
  computedAt: Date;
}

export type ProcessingStatus = 'idle' | 'processing' | 'completed' | 'failed';

export interface CozoScopeProcessingState {
  scopeType: GraphScope;
  scopeId: string;
  groupId: string;
  lastProcessedAt?: Date;
  status: ProcessingStatus;
  progressPct: number;
  currentStep?: string;
  errorMessage?: string;
}

export interface CozoQueryResult<T = unknown> {
  ok: boolean;
  rows?: T[];
  headers?: string[];
  took?: number;
  message?: string;
}

// Layer 1 mapping functions removed


export function mapRowToEntity(row: unknown[]): CozoEntity {
  return {
    id: row[0] as string,
    name: row[1] as string,
    entityKind: row[2] as CozoEntityKind,
    entitySubtype: row[3] as string | undefined,
    groupId: row[4] as string,
    scopeType: row[5] as GraphScope,
    createdAt: new Date(row[6] as number),
    extractionMethod: row[7] as 'regex' | 'llm' | 'manual',
    summary: row[8] as string | undefined,
    aliases: row[9] as string[],
    canonicalNoteId: row[10] as string | undefined,
    frequency: row[11] as number,
    degreeCentrality: row[12] as number | undefined,
    betweennessCentrality: row[13] as number | undefined,
    closenessCentrality: row[14] as number | undefined,
    communityId: row[15] as string | undefined,
    attributes: row[16] as Record<string, unknown> | undefined,
    temporalSpan: row[17] as CozoTemporalSpan | undefined,
    participants: row[18] as string[],
  };
}

export function mapRowToEntityEdge(row: unknown[]): CozoEntityEdge {
  return {
    id: row[0] as string,
    sourceId: row[1] as string,
    targetId: row[2] as string,
    createdAt: new Date(row[3] as number),
    validAt: new Date(row[4] as number),
    invalidAt: row[5] ? new Date(row[5] as number) : undefined,
    groupId: row[6] as string,
    scopeType: row[7] as GraphScope,
    edgeType: row[8] as string,
    fact: row[9] as string | undefined,
    episodeIds: row[10] as string[],
    noteIds: row[11] as string[],
    weight: row[12] as number,
    pmiScore: row[13] as number | undefined,
    confidence: row[14] as number,
    extractionMethods: row[15] as string[],
  };
}
