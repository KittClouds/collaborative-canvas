import type { CozoDbService } from '@/lib/cozo/db';

export function createGuardedCozoDb(original: CozoDbService): CozoDbService {
  if (import.meta.env.DEV) {
    return new Proxy(original, {
      get(target, prop) {
        if (prop === 'runQuery' || prop === 'run') {
          return (...args: unknown[]) => {
            const stack = new Error().stack || '';
            const isSyncEngine = stack.includes('SyncEngine') || 
                                  stack.includes('executeBatch') ||
                                  stack.includes('hydrateFromCozo');
            const isMigration = stack.includes('migration') ||
                                stack.includes('initBlueprintHubSchema') ||
                                stack.includes('initializeSchema');
            const isAllowed = isSyncEngine || isMigration;
            
            if (!isAllowed) {
              console.warn(
                '[CozoDB Guard] Direct CozoDB access detected outside SyncEngine.\n' +
                'Consider using SyncEngine methods instead for data consistency.\n' +
                'Stack trace:',
                stack.split('\n').slice(1, 5).join('\n')
              );
            }
            
            return (target[prop as keyof CozoDbService] as Function).apply(target, args);
          };
        }
        return target[prop as keyof CozoDbService];
      }
    });
  }
  return original;
}

export function validateSyncEngineImports(): void {
  if (import.meta.env.DEV) {
    console.info(
      '[SyncEngine] Architecture guidelines:\n' +
      '1. All note/folder/entity/edge operations should go through SyncEngine\n' +
      '2. Direct CozoDB access should only be used for schema operations\n' +
      '3. Graph views should read from useGraphProjection() hook\n' +
      '4. No localStorage reads after migration is complete'
    );
  }
}

export function warnOnLocalStorageAccess(): void {
  if (import.meta.env.DEV) {
    const migrationComplete = localStorage.getItem('cozo-migration-complete') === 'true';
    if (migrationComplete) {
      const originalGetItem = localStorage.getItem.bind(localStorage);
      localStorage.getItem = (key: string) => {
        if (key === 'networked-notes-data') {
          console.warn(
            '[Storage Guard] localStorage access detected after migration.\n' +
            'Notes data should now be read from SyncEngine/CozoDB.'
          );
        }
        return originalGetItem(key);
      };
    }
  }
}

export interface SyncHealthReport {
  cacheSize: {
    notes: number;
    folders: number;
    entities: number;
    edges: number;
  };
  graphProjection: {
    nodeCount: number;
    edgeCount: number;
    isDirty: boolean;
    lastUpdated: number;
  };
  pendingWrites: number;
  isHydrated: boolean;
}

export function getSyncHealthReport(engine: {
  getNotes: () => unknown[];
  getFolders: () => unknown[];
  getEntities: () => unknown[];
  getEdges: () => unknown[];
  getGraphProjection: () => {
    nodes: unknown[];
    edges: unknown[];
    isDirty: boolean;
    lastUpdated: number;
  };
  hasPendingWrites: () => boolean;
  isReady: () => boolean;
}): SyncHealthReport {
  const projection = engine.getGraphProjection();
  
  return {
    cacheSize: {
      notes: engine.getNotes().length,
      folders: engine.getFolders().length,
      entities: engine.getEntities().length,
      edges: engine.getEdges().length,
    },
    graphProjection: {
      nodeCount: projection.nodes.length,
      edgeCount: projection.edges.length,
      isDirty: projection.isDirty,
      lastUpdated: projection.lastUpdated,
    },
    pendingWrites: engine.hasPendingWrites() ? 1 : 0,
    isHydrated: engine.isReady(),
  };
}

export function logSyncHealth(engine: Parameters<typeof getSyncHealthReport>[0]): void {
  if (import.meta.env.DEV) {
    const report = getSyncHealthReport(engine);
    console.groupCollapsed('[SyncEngine Health Report]');
    console.table(report.cacheSize);
    console.log('Graph Projection:', report.graphProjection);
    console.log('Pending Writes:', report.pendingWrites);
    console.log('Is Hydrated:', report.isHydrated);
    console.groupEnd();
  }
}
