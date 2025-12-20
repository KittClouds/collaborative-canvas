export * from './interfaces';

export { EntityStoreImpl, getEntityStoreImpl, resetEntityStore } from './impl/EntityStoreImpl';
export { EdgeStoreImpl, getEdgeStoreImpl, resetEdgeStore } from './impl/EdgeStoreImpl';
export { MentionStoreImpl, getMentionStoreImpl, resetMentionStore } from './impl/MentionStoreImpl';
export { BlueprintStoreImpl, getBlueprintStoreImpl, resetBlueprintStore } from './impl/BlueprintStoreImpl';
export { TemporalStoreImpl, getTemporalStoreImpl, resetTemporalStore } from './impl/TemporalStoreImpl';
export { EmbeddingStoreImpl, getEmbeddingStoreImpl, resetEmbeddingStore } from './impl/EmbeddingStoreImpl';

import type {
  IEntityStore,
  IEdgeStore,
  IMentionStore,
  IBlueprintStore,
  ITemporalStore,
  IEmbeddingStore,
  IStorageService,
} from './interfaces';

import { getEntityStoreImpl } from './impl/EntityStoreImpl';
import { getEdgeStoreImpl } from './impl/EdgeStoreImpl';
import { getMentionStoreImpl } from './impl/MentionStoreImpl';
import { getBlueprintStoreImpl } from './impl/BlueprintStoreImpl';
import { getTemporalStoreImpl } from './impl/TemporalStoreImpl';
import { getEmbeddingStoreImpl } from './impl/EmbeddingStoreImpl';

export function getEntityStore(): IEntityStore {
  return getEntityStoreImpl();
}

export function getEdgeStore(): IEdgeStore {
  return getEdgeStoreImpl();
}

export function getMentionStore(): IMentionStore {
  return getMentionStoreImpl();
}

export function getBlueprintStore(): IBlueprintStore {
  return getBlueprintStoreImpl();
}

export function getTemporalStore(): ITemporalStore {
  return getTemporalStoreImpl();
}

export function getEmbeddingStore(): IEmbeddingStore {
  return getEmbeddingStoreImpl();
}

export function getStorageService(): IStorageService {
  return {
    entities: getEntityStore(),
    edges: getEdgeStore(),
    mentions: getMentionStore(),
    blueprints: getBlueprintStore(),
    temporal: getTemporalStore(),
    embeddings: getEmbeddingStore(),
  };
}

export async function initializeStorage(): Promise<void> {
  const blueprintStore = getBlueprintStore();
  await blueprintStore.initialize();
  console.log('Storage service initialized');
}
