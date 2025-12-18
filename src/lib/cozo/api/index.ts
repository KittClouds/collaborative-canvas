export {
  buildGraph,
  buildNoteGraph,
  buildFolderGraph,
  buildVaultGraph,
  getGraphStats,
  clearGraphData,
  type GraphBuildOptions,
  type GraphBuildResult,
  type CooccurrenceConfig,
  type CausalConfig,
} from './graphBuilder';

export {
  runNoteAnalytics,
  runFolderAnalytics,
  runVaultAnalytics,
} from './analytics';

export {
  handleGetSnapshot,
  handleGetProvenance,
  handleGetEntityHistory,
  handleGetEdgeHistory,
  handleGetDiff,
  handleGetTimeline,
  handleSearchWithDateRange,
} from './temporal';

export {
  handleGetImportance,
  handleCompareImportance,
  handleGetCommunities,
  handleGetBridges,
  handleFindPath,
  handleGetNeighbors,
  handleGetComponents,
  handleDetectPlotHoles,
} from './graphAlgorithms';

export {
  createMention,
  updateMentionStatus,
  getMentionsByNoteId,
  getMentionsByEntityId,
  deleteMention,
  type Mention,
  type CreateMentionInput,
} from './mentions';

export {
  upsertEntity,
  getEntityById,
  findEntityByName,
  deleteEntity,
  type Entity,
  type CreateEntityInput,
} from './entities';

export {
  createMentionEdge,
  getEdgesBySourceId,
  deleteEdge,
  type EntityEdge,
  type CreateEdgeInput,
} from './edges';
