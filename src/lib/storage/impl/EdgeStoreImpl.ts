// Removed: UnifiedGraph imports
import type {
  IEdgeStore,
  EntityEdge,
  CreateEdgeInput,
} from '../interfaces';

export class EdgeStoreImpl implements IEdgeStore {
  constructor() {
    // this.graph = getGraph();
  }

  async createEdge(input: CreateEdgeInput): Promise<EntityEdge> {
    console.warn('EdgeStoreImpl.createEdge: UnifiedGraph is removed. This is a stub.');
    return {} as any;
  }

  async createMentionEdge(input: CreateEdgeInput): Promise<EntityEdge> {
    return {} as any;
  }

  async getEdgeById(id: string): Promise<EntityEdge | null> {
    return null;
  }

  async getEdgesBySourceId(sourceId: string): Promise<EntityEdge[]> {
    return [];
  }

  async getEdgesByTargetId(targetId: string): Promise<EntityEdge[]> {
    return [];
  }

  async getEdgesBetween(sourceId: string, targetId: string): Promise<EntityEdge[]> {
    return [];
  }

  async deleteEdge(id: string): Promise<void> { }

  async getAllEdges(groupId?: string): Promise<EntityEdge[]> {
    return [];
  }
}

let edgeStoreInstance: EdgeStoreImpl | null = null;

export function getEdgeStoreImpl(): EdgeStoreImpl {
  if (!edgeStoreInstance) {
    edgeStoreInstance = new EdgeStoreImpl();
  }
  return edgeStoreInstance;
}

export function resetEdgeStore(): void {
  edgeStoreInstance = null;
}
