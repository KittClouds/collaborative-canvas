// Layer 1 schemas (notes, folders, etc.) are now managed exclusively by SQLite.
// CozoDB only tracks graph metadata.


export { EPISODE_SCHEMA, EPISODE_QUERIES, buildGroupId, parseGroupId } from './layer2-episodes';
export {
  ENTITY_SCHEMA,
  ENTITY_QUERIES,
  ENTITY_KINDS,
  getCanonicalEntityId
} from './layer2-entities';
export { MENTIONS_SCHEMA, MENTIONS_QUERIES } from './layer2-mentions';
export { ENTITY_EDGE_SCHEMA, ENTITY_EDGE_QUERIES, getEdgeId } from './layer2-edges';
export {
  NARRATIVE_HIERARCHY_SCHEMA,
  CAUSAL_LINK_SCHEMA,
  NARRATIVE_SCHEMA,
  NARRATIVE_QUERIES,
  NARRATIVE_HIERARCHY_RULES,
  isValidHierarchy
} from './layer2-narrative';
export {
  TEMPORAL_POINT_SCHEMA,
  TEMPORAL_QUERIES,
  GRANULARITY_TYPES,
  TIME_OF_DAY_VALUES,
  DURATION_UNITS,
  TIME_SOURCE_VALUES,
} from './layer2-temporal';
export {
  TEMPORAL_MENTION_SCHEMA,
  TEMPORAL_MENTION_QUERIES,
  type TemporalMentionRow,
} from './layer2-temporal-mentions';
export {
  COMMUNITY_SCHEMA,
  COMMUNITY_MEMBER_SCHEMA,
  GRAPH_STATS_SCHEMA,
  SCOPE_PROCESSING_STATE_SCHEMA,
  SCHEMA_VERSION_SCHEMA,
  ANALYTICS_SCHEMA,
  ANALYTICS_QUERIES
} from './layer2-analytics';
export { LAYER1_INDICES, LAYER2_INDICES, ALL_INDICES, INDEX_QUERIES } from './indices';

export {
  FOLDER_HIERARCHY_SCHEMA,
  FOLDER_HIERARCHY_QUERIES
} from './layer2-folder-hierarchy';

export {
  NETWORK_INSTANCE_SCHEMA,
  NETWORK_INSTANCE_QUERIES
} from './layer2-network-instance';

export {
  NETWORK_MEMBERSHIP_SCHEMA,
  NETWORK_MEMBERSHIP_QUERIES
} from './layer2-network-membership';

export {
  NETWORK_RELATIONSHIP_SCHEMA,
  NETWORK_RELATIONSHIP_QUERIES
} from './layer2-network-relationship';

export { UNIFIED_EDGE_QUERIES } from './layer2-unified-edges';

export {
  MUTATION_LOG_SCHEMA,
  MUTATION_LOG_QUERIES
} from './layer1-mutation-log';

export {
  applyEmbeddingSchema,
  getEmbeddingForNote,
  saveEmbeddingForNote,
  getEmbeddingStats,
  updateEmbeddingStats,
  getAllNoteEmbeddings,
  EMBEDDING_SCHEMA_VERSION
} from './embeddingSchema';

export {
  initCozoGraphSchema,
  checkSchemaExists,
  getSchemaVersion,
  resetSchema,
  listRelations,
  getRelationInfo,
  SCHEMA_VERSION,
  type SchemaInitResult
} from './init';
