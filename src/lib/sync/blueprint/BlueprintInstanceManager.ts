import type { SyncEntity, UpsertEntityPayload, ProvenanceRecord } from '../types';
import type { EntityTypeDef, FieldDef } from '@/features/blueprint-hub/types';
import { blueprintValidator, type ValidationResult } from './BlueprintValidator';
import { relationshipTrigger } from './RelationshipTrigger';
import { syncEvents } from '../events/SyncEventEmitter';
import { generateId } from '@/lib/utils/ids';

type EntityUpsertFn = (payload: UpsertEntityPayload) => SyncEntity;
type EntityFinderFn = (id: string) => SyncEntity | undefined;
type EntitiesGetterFn = () => SyncEntity[];

interface BlueprintTypeCache {
  entityType: EntityTypeDef;
  fields: FieldDef[];
}

export class BlueprintInstanceManager {
  private upsertEntity: EntityUpsertFn | null = null;
  private getEntityById: EntityFinderFn | null = null;
  private getAllEntities: EntitiesGetterFn | null = null;
  private typeCache: Map<string, BlueprintTypeCache> = new Map();

  registerEntityHandlers(
    upsert: EntityUpsertFn,
    finder: EntityFinderFn,
    getter: EntitiesGetterFn
  ): void {
    this.upsertEntity = upsert;
    this.getEntityById = finder;
    this.getAllEntities = getter;
  }

  registerBlueprintType(entityType: EntityTypeDef, fields: FieldDef[]): void {
    this.typeCache.set(entityType.entity_type_id, { entityType, fields });
  }

  clearTypeCache(): void {
    this.typeCache.clear();
  }

  validateAgainstSchema(
    entityTypeId: string,
    data: Record<string, unknown>
  ): ValidationResult {
    const cached = this.typeCache.get(entityTypeId);
    if (!cached) {
      return {
        isValid: false,
        errors: [{ field: '_type', message: 'Unknown entity type', code: 'UNKNOWN_TYPE' }],
        warnings: [],
      };
    }

    return blueprintValidator.validateAllFields(cached.fields, data);
  }

  createInstance(
    entityTypeId: string,
    name: string,
    data: Record<string, unknown>,
    noteId?: string
  ): SyncEntity | ValidationResult {
    if (!this.upsertEntity) {
      throw new Error('Entity handlers not registered');
    }

    const cached = this.typeCache.get(entityTypeId);
    if (!cached) {
      return {
        isValid: false,
        errors: [{ field: '_type', message: 'Unknown entity type', code: 'UNKNOWN_TYPE' }],
        warnings: [],
      };
    }

    const validation = this.validateAgainstSchema(entityTypeId, data);
    if (!validation.isValid) {
      syncEvents.emit('blueprintInstanceValidationFailed', {
        entityTypeId,
        name,
        errors: validation.errors,
      }, 'BlueprintInstanceManager');
      return validation;
    }

    const now = Date.now();
    const provenance: ProvenanceRecord = {
      source: 'blueprint',
      confidence: 1.0,
      timestamp: now,
      noteId,
    };

    const entity = this.upsertEntity({
      name,
      entityKind: cached.entityType.entity_kind,
      entitySubtype: cached.entityType.entity_subtype || null,
      groupId: noteId || 'global',
      scopeType: noteId ? 'note' : 'vault',
      frequency: 1,
      canonicalNoteId: noteId || null,
      source: 'blueprint',
      confidence: 1.0,
      blueprintTypeId: entityTypeId,
      blueprintVersionId: cached.entityType.version_id,
      blueprintFields: validation.coercedData || data,
      provenanceData: [provenance],
      alternateTypes: [],
      extractionMethod: 'manual',
    });

    syncEvents.emit('blueprintInstanceCreated', {
      entityId: entity.id,
      entityTypeId,
      blueprintId: cached.entityType.version_id,
      noteId,
    }, 'BlueprintInstanceManager');

    relationshipTrigger.onEntityCreated(entity);

    return entity;
  }

  updateInstance(
    entityId: string,
    data: Record<string, unknown>
  ): SyncEntity | ValidationResult | null {
    if (!this.upsertEntity || !this.getEntityById) {
      throw new Error('Entity handlers not registered');
    }

    const existing = this.getEntityById(entityId);
    if (!existing) {
      return null;
    }

    if (!existing.blueprintTypeId) {
      return {
        isValid: false,
        errors: [{ field: '_type', message: 'Entity is not a blueprint instance', code: 'NOT_BLUEPRINT' }],
        warnings: [],
      };
    }

    const validation = this.validateAgainstSchema(existing.blueprintTypeId, data);
    if (!validation.isValid) {
      syncEvents.emit('blueprintInstanceValidationFailed', {
        entityTypeId: existing.blueprintTypeId,
        entityId,
        errors: validation.errors,
      }, 'BlueprintInstanceManager');
      return validation;
    }

    const previousData = { ...existing };

    const mergedFields = {
      ...(existing.blueprintFields || {}),
      ...(validation.coercedData || data),
    };

    const entity = this.upsertEntity({
      id: entityId,
      name: existing.name,
      entityKind: existing.entityKind,
      entitySubtype: existing.entitySubtype,
      groupId: existing.groupId,
      scopeType: existing.scopeType,
      frequency: existing.frequency,
      canonicalNoteId: existing.canonicalNoteId,
      source: existing.source,
      confidence: existing.confidence,
      blueprintTypeId: existing.blueprintTypeId,
      blueprintVersionId: existing.blueprintVersionId,
      blueprintFields: mergedFields,
      provenanceData: existing.provenanceData,
      alternateTypes: existing.alternateTypes,
      extractionMethod: existing.extractionMethod,
    });

    syncEvents.emit('blueprintInstanceUpdated', {
      entityId: entity.id,
      entityTypeId: existing.blueprintTypeId,
      blueprintId: existing.blueprintVersionId || '',
      noteId: existing.canonicalNoteId || undefined,
    }, 'BlueprintInstanceManager');

    relationshipTrigger.onEntityUpdated(entity, previousData);

    return entity;
  }

  linkToNote(entityId: string, noteId: string): boolean {
    if (!this.upsertEntity || !this.getEntityById) {
      return false;
    }

    const existing = this.getEntityById(entityId);
    if (!existing) return false;

    this.upsertEntity({
      id: entityId,
      name: existing.name,
      entityKind: existing.entityKind,
      entitySubtype: existing.entitySubtype,
      groupId: existing.groupId,
      scopeType: existing.scopeType,
      frequency: existing.frequency,
      canonicalNoteId: noteId,
      source: existing.source,
      confidence: existing.confidence,
      blueprintTypeId: existing.blueprintTypeId,
      blueprintVersionId: existing.blueprintVersionId,
      blueprintFields: existing.blueprintFields,
      provenanceData: existing.provenanceData,
      alternateTypes: existing.alternateTypes,
      extractionMethod: existing.extractionMethod,
    });

    return true;
  }

  getInstancesOfType(entityTypeId: string): SyncEntity[] {
    if (!this.getAllEntities) return [];

    return this.getAllEntities().filter(e => e.blueprintTypeId === entityTypeId);
  }

  getInstancesByKind(entityKind: string): SyncEntity[] {
    if (!this.getAllEntities) return [];

    return this.getAllEntities().filter(
      e => e.entityKind === entityKind && e.source === 'blueprint'
    );
  }

  isValidInstance(entity: SyncEntity): boolean {
    if (!entity.blueprintTypeId || !entity.blueprintFields) {
      return false;
    }

    const cached = this.typeCache.get(entity.blueprintTypeId);
    if (!cached) return false;

    const validation = blueprintValidator.validateAllFields(
      cached.fields,
      entity.blueprintFields
    );

    return validation.isValid;
  }
}

export const blueprintInstanceManager = new BlueprintInstanceManager();
