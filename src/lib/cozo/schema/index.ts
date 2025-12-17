export { NOTE_SCHEMA, NOTE_QUERIES } from './layer1-notes';
export { FOLDER_SCHEMA, FOLDER_QUERIES, FOLDER_PATH_RULE } from './layer1-folders';
export {
  WIKILINK_SCHEMA,
  NOTE_TAG_SCHEMA,
  NOTE_MENTION_SCHEMA,
  BACKLINK_SCHEMA,
  LINKS_SCHEMA,
  LINK_QUERIES
} from './layer1-links';

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
  applyEmbeddingSchema,
  getEmbeddingForNote,
  saveEmbeddingForNote,
  getEmbeddingStats,
  updateEmbeddingStats,
  getAllNoteEmbeddings,
  EMBEDDING_SCHEMA_VERSION
} from './embeddingSchema';

export {
  initializeSchema,
  checkSchemaExists,
  getSchemaVersion,
  resetSchema,
  listRelations,
  getRelationInfo,
  SCHEMA_VERSION,
  type SchemaInitResult
} from './init';
