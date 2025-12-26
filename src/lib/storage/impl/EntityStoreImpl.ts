// Removed: UnifiedGraph imports
import type { EntityKind } from '@/lib/entities/entityTypes';
import type {
  IEntityStore,
  Entity,
  CreateEntityInput,
} from '../interfaces';

export class EntityStoreImpl implements IEntityStore {
  constructor() {
    // this.graph = getGraph();
  }

  async upsertEntity(input: CreateEntityInput): Promise<Entity> {
    console.warn('EntityStoreImpl.upsertEntity: UnifiedGraph is removed. This is a stub.');
    return {} as any;
  }

  async getEntityById(id: string): Promise<Entity | null> {
    return null;
  }

  async findEntityByName(name: string, kind: string, groupId: string): Promise<Entity | null> {
    return null;
  }

  async findEntityByNameOnly(name: string, groupId: string): Promise<Entity | null> {
    return null;
  }

  async deleteEntity(id: string): Promise<void> { }

  async getEntitiesByKind(kind: string, groupId: string): Promise<Entity[]> {
    return [];
  }

  async getAllEntities(groupId: string): Promise<Entity[]> {
    return [];
  }

  async updateEntityFrequency(id: string, frequency: number): Promise<void> { }

  /*
  private nodeToEntity(node: any): Entity {
    // ...
    return {} as any;
  }
  */
}

let entityStoreInstance: EntityStoreImpl | null = null;

export function getEntityStoreImpl(): EntityStoreImpl {
  if (!entityStoreInstance) {
    entityStoreInstance = new EntityStoreImpl();
  }
  return entityStoreInstance;
}

export function resetEntityStore(): void {
  entityStoreInstance = null;
}
