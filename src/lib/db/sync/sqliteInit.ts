// Removed: UnifiedGraph imports
import { dbClient } from '@/lib/db/client/db-client';
// import { graphSQLiteSync } from '@/lib/db/sync/GraphSQLiteSync';
import { Hydration } from '@/lib/db/sync/Hydration';
// import { syncState } from '@/lib/db/sync/SyncState';
// import type { SQLiteNode, SQLiteEdge, SQLiteNodeInput } from '@/lib/db/client/types';
// import { parseJson } from '@/lib/db/client/types';
import { RelationshipStoreImpl } from '@/lib/storage/impl/RelationshipStoreImpl';
import { relationshipDBAdapter } from '@/lib/storage/impl/RelationshipDBAdapter';
import { setRelationshipStore, initializeRelationshipSystem } from '@/lib/relationships/startup';

export interface SQLiteInitResult {
  nodesLoaded: number;
  edgesLoaded: number;
  embeddingsLoaded: number;
  relationshipsLoaded: number;
}

export async function initializeSQLiteAndHydrate(): Promise<SQLiteInitResult> {
  await dbClient.init();

  const hydration = new Hydration({ progressive: true });
  const result = await hydration.hydrate();

  const embeddings = await dbClient.getAllEmbeddings();

  const relationshipStore = new RelationshipStoreImpl(relationshipDBAdapter);
  setRelationshipStore(relationshipStore);
  const relResult = await initializeRelationshipSystem();

  return {
    nodesLoaded: result.nodesLoaded,
    edgesLoaded: result.edgesLoaded,
    embeddingsLoaded: embeddings.length,
    relationshipsLoaded: relResult.loaded,
  };
}
