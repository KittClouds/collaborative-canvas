export {
  buildCooccurrenceGraph,
  getCooccurrenceEdges,
  type CooccurrenceOptions,
  type CooccurrenceResult,
} from './cooccurrenceBuilder';

export {
  buildWindowCooccurrenceGraph,
  type WindowOptions,
  type WindowCooccurrenceResult,
  type WindowType,
} from './windowCooccurrence';

export {
  mergeEdgesAcrossScopes,
  mergeNotesIntoFolder,
  mergeFoldersIntoVault,
  type MergeOptions,
  type MergeResult,
  type MergeStrategy,
} from './scopeMerger';

export {
  extractCausalLinks,
  getCausalLinks,
  getCausalChain,
  deleteCausalLink,
  type CausalLinkOptions,
  type CausalLinkResult,
  type CausalType,
} from './causalLinks';
