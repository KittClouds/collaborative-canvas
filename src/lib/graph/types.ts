import type { EntityKind, NarrativeEntityKind } from '@/lib/entities/entityTypes';
import type { TemporalPoint, DurationUnit, TimeOfDay } from '@/types/temporal';

// ===== CORE IDS =====
export type NodeId = string; // UUIDv7
export type EdgeId = string; // UUIDv7
export type EpisodeId = string; // UUIDv7
export type CommunityId = string; // UUIDv7

// ===== NARRATIVE HIERARCHY MAPPING =====

/**
 * Narrative hierarchy structure (top to bottom)
 * NARRATIVE → TIMELINE → ARC → ACT → CHAPTER → SCENE → BEAT → EVENT
 */
export const NARRATIVE_HIERARCHY: Record<NarrativeEntityKind, number> = {
  NARRATIVE: 0,  // Top level (Book, Series, Story)
  TIMELINE: 1,   // Master timeline or character timeline
  ARC: 2,        // Story arc (main plot, subplot)
  ACT: 3,        // Act structure (3-act, 5-act)
  CHAPTER: 4,    // Chapter
  SCENE: 5,      // Scene within chapter
  BEAT: 6,       // Beat within scene
  EVENT: 7,      // Individual event
} as const;

/**
 * Get parent narrative types for a given type
 */
export function getParentNarrativeTypes(kind: NarrativeEntityKind): NarrativeEntityKind[] {
  const level = NARRATIVE_HIERARCHY[kind];
  return (Object.entries(NARRATIVE_HIERARCHY) as [NarrativeEntityKind, number][])
    .filter(([_, l]) => l < level)
    .map(([k]) => k)
    .sort((a, b) => NARRATIVE_HIERARCHY[a] - NARRATIVE_HIERARCHY[b]);
}

/**
 * Get child narrative types for a given type
 */
export function getChildNarrativeTypes(kind: NarrativeEntityKind): NarrativeEntityKind[] {
  const level = NARRATIVE_HIERARCHY[kind];
  return (Object.entries(NARRATIVE_HIERARCHY) as [NarrativeEntityKind, number][])
    .filter(([_, l]) => l > level)
    .map(([k]) => k)
    .sort((a, b) => NARRATIVE_HIERARCHY[a] - NARRATIVE_HIERARCHY[b]);
}

/**
 * Check if one narrative type can contain another
 */
export function canContain(parent: NarrativeEntityKind, child: NarrativeEntityKind): boolean {
  return NARRATIVE_HIERARCHY[parent] < NARRATIVE_HIERARCHY[child];
}

// ===== NODE TYPES (Extended, not replaced) =====

export type NodeType =
  | 'NOTE'
  | 'FOLDER'
  | 'ENTITY'
  | 'BLUEPRINT'
  | 'TEMPORAL'
  | 'COMMUNITY'; // NEW: For faction/family clusters

// ===== EDGE TYPES (Extended) =====

export type EdgeType =
  // Container relationships
  | 'CONTAINS'
  | 'PARENT_OF'
  | 'PART_OF'

  // Reference relationships
  | 'BACKLINK'
  | 'MENTIONS'
  | 'REFERENCES'

  // Entity relationships
  | 'KNOWS'
  | 'LOCATED_IN'
  | 'OWNS'
  | 'MEMBER_OF'
  | 'RELATED_TO'
  | 'DERIVED_FROM'
  | 'CO_OCCURS'

  // Temporal relationships
  | 'BEFORE'
  | 'DURING'
  | 'AFTER'
  | 'OVERLAPS'

  // Causal relationships
  | 'CAUSED_BY'
  | 'LEADS_TO'
  | 'ENABLES'
  | 'PREVENTS'

  // Narrative relationships
  | 'FORESHADOWS'
  | 'PARALLELS'
  | 'CONTRASTS'

  // Blueprint relationships
  | 'INSTANCE_OF'
  | 'CONFORMS_TO'

  // Episode relationships (NEW)
  | 'APPEARS_IN' // Character appears in Scene
  | 'OCCURS_IN'  // Event occurs in Scene
  | 'BELONGS_TO' // Entity belongs to Community

  | string; // Custom edge types from blueprints

// ===== EPISODE SYSTEM =====

/**
 * Episode: Temporal container for narrative events
 * 
 * Maps directly to your existing structure:
 * - NARRATIVE node → Series/Book episode
 * - ARC node → Story arc episode
 * - ACT node → Act episode
 * - CHAPTER node → Chapter episode
 * - SCENE node → Scene episode
 * - BEAT node → Beat episode
 * - EVENT node → Event episode
 */
export interface Episode {
  id: EpisodeId;
  name: string;
  content: string;

  // Node reference (backwards compat)
  node_id: NodeId; // The actual SCENE/CHAPTER/etc node
  entity_kind: NarrativeEntityKind; // SCENE, CHAPTER, etc.
  entity_subtype?: string;

  // Hierarchy (maps to your folder structure)
  parent_episode_id?: EpisodeId; // Chapter contains Scenes
  child_episode_ids: EpisodeId[];
  hierarchy_level: number; // From NARRATIVE_HIERARCHY

  // Temporal bounds
  valid_at: Date; // When this happens in story timeline
  valid_to?: Date; // End time (for spans)
  sequence_number?: number; // Order within parent

  // Source tracking
  source: string; // "Chapter 3", "Act 2: Rising Action"
  source_description: string;

  // Participants (entities present in this episode)
  entity_ids: NodeId[]; // Characters, locations, items in this scene
  primary_entity_ids?: NodeId[]; // POV character, main location

  // Namespace (story/world isolation)
  namespace: string; // "Book 1", "Shared Universe"

  // Metadata (your existing narrative/scene/event metadata)
  metadata: EpisodeMetadata;

  created_at: Date;
  updated_at: Date;
}

/**
 * Episode metadata - combines your existing metadata types
 */
export interface EpisodeMetadata {
  // From NarrativeMetadata
  status?: 'planning' | 'drafting' | 'complete' | 'revision';
  purpose?: string;
  theme?: string;
  stakes?: 'low' | 'medium' | 'high' | 'critical';
  emotional_tone?: string;
  word_count?: number;
  target_word_count?: number;

  // From SceneMetadata
  location_id?: NodeId;
  secondary_location_ids?: NodeId[];
  pov_character_id?: NodeId;
  participant_ids?: NodeId[];
  scene_type?: 'setup' | 'conflict' | 'revelation' | 'transition' | 'climax' | 'resolution';
  conflict?: string;
  sensory_details?: string;
  time_of_day?: TimeOfDay;

  // From EventMetadata
  event_type?: 'plot' | 'historical' | 'personal' | 'world' | 'background';
  scope?: 'personal' | 'local' | 'regional' | 'global' | 'cosmic';
  impact?: 'minor' | 'moderate' | 'major' | 'catastrophic';
  visibility?: 'secret' | 'private' | 'public' | 'legendary';
  cause_event_id?: NodeId;
  consequence_event_ids?: NodeId[];

  // Additional
  tags?: string[];
  notes?: string;
}

// ===== COMMUNITY SYSTEM =====

/**
 * Community: Hierarchical grouping of related entities
 * 
 * Your existing FACTION folders map directly to communities
 */
export interface Community {
  id: CommunityId;
  name: string;
  description: string;

  // Node reference (backwards compat)
  node_id: NodeId; // The actual FACTION/etc node
  entity_kind: EntityKind; // FACTION, CHARACTER (for families), LOCATION

  // Hierarchy
  parent_community_id?: CommunityId;
  child_community_ids: CommunityId[];
  level: number; // 0 = root, higher = more specific

  // Members
  entity_ids: NodeId[];
  leader_id?: NodeId;

  // Community type
  community_type: CommunityType;

  // Namespace
  namespace: string;

  // Metadata
  attributes: Record<string, unknown>;

  created_at: Date;
  updated_at: Date;
}

export type CommunityType =
  | 'FACTION' // Your FACTION folders
  | 'FAMILY' // CHARACTER-based communities
  | 'LOCATION_GROUP' // LOCATION-based communities
  | 'ALLIANCE' // Multi-faction alliances
  | 'PROFESSION' // Guilds, orders
  | 'SPECIES' // Races, creatures
  | 'CUSTOM'; // Blueprint-defined

// ===== NAMESPACE SYSTEM =====

/**
 * Namespace: Isolate different stories/worlds
 */
export interface GraphNamespace {
  id: string;
  name: string;
  description?: string;

  // Type
  type: 'STORY' | 'WORLD' | 'CAMPAIGN' | 'SHARED_UNIVERSE';

  // Root narrative node
  root_narrative_id?: NodeId; // The NARRATIVE node for this namespace

  // Statistics
  stats: NamespaceStats;

  created_at: Date;
  updated_at: Date;
}

export interface NamespaceStats {
  node_count: number;
  episode_count: number;
  community_count: number;
  entity_count: number;
  last_activity: Date;
}

// ===== EXTRACTION TYPES (Existing) =====

export type ExtractionMethod = 'regex' | 'ner' | 'llm' | 'manual';

export interface EntityMention {
  noteId: NodeId;
  charPosition: number;
  sentenceIndex?: number;
  context: string;
}

export interface ExtractionData {
  method: ExtractionMethod;
  confidence: number;
  mentions: EntityMention[];
  frequency: number;
}

// ===== TEMPORAL TYPES (Existing) =====

export interface TemporalData {
  type: 'point' | 'span';
  start: TemporalPoint;
  end?: TemporalPoint;
  duration?: {
    value: number;
    unit: DurationUnit;
  };
  confidence: number;
  source: 'parsed' | 'manual' | 'inferred';
  locked: boolean;
}

export interface TemporalRelation {
  relationType: 'before' | 'after' | 'during' | 'overlaps';
  gap?: {
    value: number;
    unit: DurationUnit;
  };
}

export interface CausalityData {
  strength: 'weak' | 'moderate' | 'strong' | 'definite';
  description?: string;
}

// ===== NARRATIVE METADATA (Existing) =====

export type NarrativeStatus = 'planning' | 'drafting' | 'complete' | 'revision';
export type StakesLevel = 'low' | 'medium' | 'high' | 'critical';

export interface NarrativeMetadata {
  status?: NarrativeStatus;
  purpose?: string;
  theme?: string;
  stakes?: StakesLevel;
  emotionalTone?: string;
  wordCount?: number;
  targetWordCount?: number;
  sequence?: number;
}

export interface SceneMetadata {
  location: string;
  secondaryLocations?: string[];
  povCharacterId?: NodeId;
  participants: NodeId[];
  sceneType: 'setup' | 'conflict' | 'revelation' | 'transition' | 'climax' | 'resolution';
  conflict?: string;
  sensoryDetails?: string;
  timeOfDay?: TimeOfDay;
}

export interface EventMetadata {
  eventType: 'plot' | 'historical' | 'personal' | 'world' | 'background';
  scope: 'personal' | 'local' | 'regional' | 'global' | 'cosmic';
  participants: NodeId[];
  impact: 'minor' | 'moderate' | 'major' | 'catastrophic';
  visibility: 'secret' | 'private' | 'public' | 'legendary';
  description?: string;
  causeEventId?: NodeId;
  consequenceEventIds?: NodeId[];
}

// ===== BLUEPRINT TYPES (Existing, extended) =====

export interface BlueprintFieldTemplate {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'entity-ref' | 'episode-ref' | 'community-ref';
  required: boolean;
  defaultValue?: string;
  description?: string;
  options?: string[];
}

export interface BlueprintData {
  templates: BlueprintFieldTemplate[];
  description?: string;
  entityKind?: EntityKind;
}

// ===== UNIFIED NODE DATA (Extended) =====

export interface UnifiedNodeData {
  // Core identity
  id: NodeId;
  type: NodeType;
  label: string;

  // Entity classification (existing)
  entityKind?: EntityKind;
  entitySubtype?: string;
  isEntity?: boolean;

  // Hierarchy (existing)
  parentId?: NodeId;
  depth?: number;
  isTypedRoot?: boolean;
  isSubtypeRoot?: boolean;
  inheritedKind?: EntityKind;
  inheritedSubtype?: string;

  // Content (existing)
  content?: string;
  tags?: string[];
  isPinned?: boolean;
  favorite?: boolean;

  // References (existing)
  sourceNoteId?: NodeId;
  blueprintId?: NodeId;

  // Temporal data (existing)
  temporal?: TemporalData;

  // Existing metadata
  narrativeMetadata?: NarrativeMetadata;
  sceneMetadata?: SceneMetadata;
  eventMetadata?: EventMetadata;
  blueprintData?: BlueprintData;
  attributes?: Record<string, unknown>;
  extraction?: ExtractionData;

  // === NEW: Episode integration ===
  episode_id?: EpisodeId; // If this node IS an episode container
  appears_in_episodes?: EpisodeId[]; // Episodes this entity appears in
  first_episode_id?: EpisodeId; // First appearance
  last_episode_id?: EpisodeId; // Most recent appearance

  // === NEW: Community integration ===
  community_id?: CommunityId; // If this node IS a community
  belongs_to_communities?: CommunityId[]; // Communities this entity belongs to
  primary_community_id?: CommunityId;

  // === NEW: Namespace ===
  namespace?: string; // "default", "Book 1", "Shared World"

  // Timestamps
  createdAt: number;
  updatedAt: number;

  // Visualization (existing)
  color?: string;
  size?: number;
  shape?: string;

  // Vector embedding (existing)
  vectorId?: string;
  embeddingVersion?: string;
}

export interface UnifiedNode {
  group: 'nodes';
  data: UnifiedNodeData;
  position?: { x: number; y: number };
  classes?: string[];
}

// ===== UNIFIED EDGE DATA (Extended) =====

export interface UnifiedEdgeData {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  type: EdgeType;

  weight?: number;
  confidence?: number;
  bidirectional?: boolean;

  extractionMethod?: ExtractionMethod;
  context?: string;
  noteIds?: NodeId[];

  temporalRelation?: TemporalRelation;
  causality?: CausalityData;

  // NEW: Episode context
  episode_id?: EpisodeId; // This relationship exists within this episode

  properties?: Record<string, unknown>;

  createdAt: number;
  updatedAt?: number;

  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface UnifiedEdge {
  group: 'edges';
  data: UnifiedEdgeData;
  classes?: string[];
}

// ===== GRAPH STATS (Extended) =====

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  noteCount: number;
  folderCount: number;
  entityCount: number;
  blueprintCount: number;
  temporalCount: number;
  episodeCount: number; // NEW
  communityCount: number; // NEW
  extractionCounts: {
    regex: number;
    ner: number;
    llm: number;
    manual: number;
  };
}

export interface GraphMetadata {
  version: string;
  lastModified: number;
  stats: GraphStats;
}

// ===== VIEW STATE (Existing) =====

export interface GraphViewState {
  selectedNodeId: NodeId | null;
  expandedFolderIds: NodeId[];
  pinnedNodeIds: NodeId[];
  viewMode: 'tree' | 'graph' | 'timeline' | 'table';
  filters: {
    nodeTypes: NodeType[];
    entityKinds: EntityKind[];
    dateRange?: { start: number; end: number };
    searchQuery?: string;
  };
}

// ===== EXPORT TYPES (Existing) =====

export interface GraphExport {
  format: 'unified-cytoscape';
  version: '1.0.0';
  timestamp: number;
  elements: {
    nodes: UnifiedNode[];
    edges: UnifiedEdge[];
  };
  metadata: GraphMetadata;
  state?: GraphViewState;
}

// ===== QUERY TYPES (Existing) =====

export interface NeighborhoodResult {
  nodes: UnifiedNode[];
  edges: UnifiedEdge[];
}

export interface PathResult {
  path: NodeId[];
  edges: EdgeId[];
  length: number;
}

// ===== FACTORY OPTIONS (Existing) =====

export interface FolderOptions {
  parentId?: NodeId;
  entityKind?: EntityKind;
  entitySubtype?: string;
  isTypedRoot?: boolean;
  isSubtypeRoot?: boolean;
  color?: string;
}

export interface NoteOptions {
  parentId?: NodeId;
  entityKind?: EntityKind;
  entitySubtype?: string;
  blueprintId?: NodeId;
  tags?: string[];
  isEntity?: boolean;
  attributes?: Record<string, unknown>;
}

export interface EntityOptions {
  entitySubtype?: string;
  sourceNoteId?: NodeId;
  blueprintId?: NodeId;
  attributes?: Record<string, unknown>;
  extraction?: ExtractionData;
  temporal?: TemporalData;
  narrativeMetadata?: NarrativeMetadata;
  sceneMetadata?: SceneMetadata;
  eventMetadata?: EventMetadata;
}

export interface SearchOptions {
  fuzzy?: boolean;
  nodeTypes?: NodeType[];
  entityKinds?: EntityKind[];
  limit?: number;
}

// ===== EXTRACTION RESULT TYPES (Existing) =====

export interface ExtractedEntity {
  kind: string;
  label: string;
  subtype?: string;
  confidence: number;
  extractionMethod: ExtractionMethod;
  positions: EntityMention[];
  attributes?: Record<string, unknown>;
}

export interface ExtractedRelationship {
  sourceLabel: string;
  sourceKind: string;
  targetLabel: string;
  targetKind: string;
  relationshipType: string;
  weight: number;
  confidence: number;
  extractionMethod: ExtractionMethod;
  noteIds: string[];
  metadata?: Record<string, unknown>;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  metadata: {
    noteId: string;
    extractionMethod: ExtractionMethod;
    timestamp: string;
    processingTime?: number;
  };
}

export interface GraphSyncResult {
  createdNodes: string[];
  updatedNodes: string[];
  createdEdges: string[];
  updatedEdges: string[];
  errors: Array<{
    entity?: string;
    relationship?: string;
    error: string;
  }>;
  stats: {
    entitiesSynced: number;
    relationshipsSynced: number;
    coOccurrencesSynced: number;
    duration: number;
  };
}

export interface GraphEntity {
  id: string;
  kind: string;
  label: string;
  subtype?: string;
  frequency: number;
  noteIds: string[];
  mentions: EntityMention[];
  extractionMethods: ExtractionMethod[];
  attributes: Record<string, unknown>;
  confidence: number;
}

export interface GraphRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;
  confidence: number;
  noteIds: string[];
  extractionMethods: ExtractionMethod[];
  metadata?: Record<string, unknown>;
}

// Re-export entity types
export { EntityKind, NarrativeEntityKind };
