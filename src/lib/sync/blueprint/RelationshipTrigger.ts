import type { SyncEntity, SyncEdge } from '../types';
import type { RelationshipTypeDef } from '@/features/blueprint-hub/types';
import { syncEvents } from '../events/SyncEventEmitter';

export class RelationshipTrigger {
  private entityHandlers: Map<string, Array<(entity: SyncEntity) => void>> = new Map();
  private relationshipTypes: RelationshipTypeDef[] = [];

  setRelationshipTypes(types: RelationshipTypeDef[]): void {
    this.relationshipTypes = types;
  }

  onEntityCreated(entity: SyncEntity): void {
    const applicableTypes = this.getApplicableRelationshipTypes(entity.entityKind);

    if (applicableTypes.length === 0) return;

    syncEvents.emit('entityExtracted', {
      entityId: entity.id,
      entityName: entity.name,
      entityType: entity.entityKind,
      source: entity.source,
      noteId: entity.canonicalNoteId || undefined,
      applicableRelationships: applicableTypes.map(t => t.relationship_name),
    }, 'RelationshipTrigger');
  }

  onEntityUpdated(entity: SyncEntity, previousData: Partial<SyncEntity>): void {
    if (previousData.entityKind && previousData.entityKind !== entity.entityKind) {
      const applicableTypes = this.getApplicableRelationshipTypes(entity.entityKind);

      syncEvents.emit('entityTypeChanged', {
        entityId: entity.id,
        entityName: entity.name,
        previousType: previousData.entityKind,
        newType: entity.entityKind,
        applicableRelationships: applicableTypes.map(t => t.relationship_name),
      }, 'RelationshipTrigger');
    }
  }

  getApplicableRelationshipTypes(entityKind: string): RelationshipTypeDef[] {
    return this.relationshipTypes.filter(
      rt => rt.source_entity_kind === entityKind || rt.target_entity_kind === entityKind
    );
  }

  findRelatedNotes(entity: SyncEntity, allNotes: Array<{ id: string; contentText: string }>): string[] {
    const relatedNoteIds: string[] = [];
    const searchTerms = [entity.name, ...entity.aliases];

    for (const note of allNotes) {
      const lowerContent = note.contentText.toLowerCase();
      for (const term of searchTerms) {
        if (lowerContent.includes(term.toLowerCase())) {
          relatedNoteIds.push(note.id);
          break;
        }
      }
    }

    return relatedNoteIds;
  }

  registerHandler(eventType: string, handler: (entity: SyncEntity) => void): () => void {
    if (!this.entityHandlers.has(eventType)) {
      this.entityHandlers.set(eventType, []);
    }
    this.entityHandlers.get(eventType)!.push(handler);

    return () => {
      const handlers = this.entityHandlers.get(eventType);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) {
          handlers.splice(idx, 1);
        }
      }
    };
  }

  suggestRelationships(
    sourceEntity: SyncEntity,
    allEntities: SyncEntity[]
  ): Array<{
    targetEntity: SyncEntity;
    relationshipType: string;
    confidence: number;
  }> {
    const suggestions: Array<{
      targetEntity: SyncEntity;
      relationshipType: string;
      confidence: number;
    }> = [];

    const applicableTypes = this.getApplicableRelationshipTypes(sourceEntity.entityKind);

    for (const relType of applicableTypes) {
      const isSource = relType.source_entity_kind === sourceEntity.entityKind;
      const targetKind = isSource ? relType.target_entity_kind : relType.source_entity_kind;

      const potentialTargets = allEntities.filter(
        e => e.entityKind === targetKind && e.id !== sourceEntity.id
      );

      for (const target of potentialTargets) {
        suggestions.push({
          targetEntity: target,
          relationshipType: relType.relationship_name,
          confidence: 0.5,
        });
      }
    }

    return suggestions;
  }
}

export const relationshipTrigger = new RelationshipTrigger();
