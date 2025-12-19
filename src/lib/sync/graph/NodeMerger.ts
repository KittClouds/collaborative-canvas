import type { SyncEntity, GraphNode, GraphNodeType, AlternateTypeInterpretation, EntitySource } from '../types';
import { ENTITY_COLORS } from '@/lib/entities/entityTypes';

const SOURCE_PRIORITY: Record<EntitySource, number> = {
  blueprint: 100,
  manual: 90,
  extracted: 50,
  concept: 30,
};

const PROVENANCE_PRIORITY: Record<string, number> = {
  manual: 100,
  title: 90,
  regex: 80,
  blueprint: 70,
  llm: 60,
  ner: 50,
  wikilink: 40,
};

export interface MergedNode {
  id: string;
  name: string;
  normalizedName: string;
  entityKind: string;
  entitySubtype: string | null;
  confidence: number;
  provenance: string[];
  alternateTypes: AlternateTypeInterpretation[];
  frequency: number;
  sourceEntities: SyncEntity[];
  isCanonical: boolean;
  blueprintTypeId: string | null;
  blueprintFields: Record<string, unknown> | null;
}

export class NodeMerger {
  groupByNormalizedName(entities: SyncEntity[]): Map<string, SyncEntity[]> {
    const groups = new Map<string, SyncEntity[]>();

    for (const entity of entities) {
      const key = entity.normalizedName;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entity);
    }

    return groups;
  }

  mergeEntityGroup(entities: SyncEntity[]): MergedNode {
    if (entities.length === 0) {
      throw new Error('Cannot merge empty entity group');
    }

    if (entities.length === 1) {
      const entity = entities[0];
      return {
        id: entity.id,
        name: entity.name,
        normalizedName: entity.normalizedName,
        entityKind: entity.entityKind,
        entitySubtype: entity.entitySubtype,
        confidence: entity.confidence,
        provenance: this.collectProvenance(entities),
        alternateTypes: entity.alternateTypes,
        frequency: entity.frequency,
        sourceEntities: entities,
        isCanonical: entity.source === 'blueprint' || entity.source === 'manual',
        blueprintTypeId: entity.blueprintTypeId,
        blueprintFields: entity.blueprintFields,
      };
    }

    const { canonicalType, canonicalSubtype, alternates } = this.resolveTypeConflict(entities);
    const aggregatedConfidence = this.aggregateConfidence(entities);
    const provenanceSources = this.collectProvenance(entities);
    const totalFrequency = entities.reduce((sum, e) => sum + e.frequency, 0);

    const primaryEntity = this.selectPrimaryEntity(entities);

    return {
      id: primaryEntity.id,
      name: primaryEntity.name,
      normalizedName: primaryEntity.normalizedName,
      entityKind: canonicalType,
      entitySubtype: canonicalSubtype,
      confidence: aggregatedConfidence,
      provenance: provenanceSources,
      alternateTypes: alternates,
      frequency: totalFrequency,
      sourceEntities: entities,
      isCanonical: entities.some(e => e.source === 'blueprint' || e.source === 'manual'),
      blueprintTypeId: primaryEntity.blueprintTypeId,
      blueprintFields: primaryEntity.blueprintFields,
    };
  }

  private selectPrimaryEntity(entities: SyncEntity[]): SyncEntity {
    return [...entities].sort((a, b) => {
      const priorityA = SOURCE_PRIORITY[a.source] ?? 0;
      const priorityB = SOURCE_PRIORITY[b.source] ?? 0;
      if (priorityA !== priorityB) return priorityB - priorityA;
      return b.confidence - a.confidence;
    })[0];
  }

  aggregateConfidence(entities: SyncEntity[]): number {
    if (entities.length === 0) return 0;
    if (entities.length === 1) return entities[0].confidence;

    const weights = entities.map(e => {
      const sourcePriority = SOURCE_PRIORITY[e.source] ?? 50;
      return sourcePriority / 100;
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const weightedSum = entities.reduce((sum, e, i) => sum + e.confidence * weights[i], 0);

    return Math.min(1, weightedSum / totalWeight);
  }

  collectProvenance(entities: SyncEntity[]): string[] {
    const sources = new Set<string>();

    for (const entity of entities) {
      sources.add(entity.source);
      for (const record of entity.provenanceData) {
        sources.add(record.source);
      }
    }

    return Array.from(sources).sort((a, b) => {
      const priorityA = PROVENANCE_PRIORITY[a] ?? 0;
      const priorityB = PROVENANCE_PRIORITY[b] ?? 0;
      return priorityB - priorityA;
    });
  }

  resolveTypeConflict(entities: SyncEntity[]): {
    canonicalType: string;
    canonicalSubtype: string | null;
    alternates: AlternateTypeInterpretation[];
  } {
    const typeGroups = new Map<string, SyncEntity[]>();
    for (const entity of entities) {
      const key = `${entity.entityKind}:${entity.entitySubtype || ''}`;
      if (!typeGroups.has(key)) {
        typeGroups.set(key, []);
      }
      typeGroups.get(key)!.push(entity);
    }

    if (typeGroups.size === 1) {
      const first = entities[0];
      return {
        canonicalType: first.entityKind,
        canonicalSubtype: first.entitySubtype,
        alternates: [],
      };
    }

    const ranked = Array.from(typeGroups.entries())
      .map(([key, group]) => {
        const [kind, subtype] = key.split(':');
        const maxPriority = Math.max(...group.map(e => SOURCE_PRIORITY[e.source] ?? 0));
        const maxConfidence = Math.max(...group.map(e => e.confidence));
        return { kind, subtype: subtype || null, maxPriority, maxConfidence, group };
      })
      .sort((a, b) => {
        if (a.maxPriority !== b.maxPriority) return b.maxPriority - a.maxPriority;
        return b.maxConfidence - a.maxConfidence;
      });

    const winner = ranked[0];
    const alternates: AlternateTypeInterpretation[] = ranked.slice(1).map(r => ({
      entityKind: r.kind,
      entitySubtype: r.subtype || undefined,
      source: r.group[0].source,
      confidence: r.maxConfidence,
      reason: `Alternative interpretation from ${r.group[0].source}`,
    }));

    return {
      canonicalType: winner.kind,
      canonicalSubtype: winner.subtype,
      alternates,
    };
  }

  toGraphNode(merged: MergedNode): GraphNode {
    const nodeType = this.determineNodeType(merged);
    const color = (ENTITY_COLORS as Record<string, string>)[merged.entityKind] || '#6b7280';
    const size = Math.min(10 + Math.log(merged.frequency + 1) * 5, 30);

    return {
      id: merged.id,
      label: merged.name,
      nodeType,
      kind: merged.entityKind,
      subtype: merged.entitySubtype,
      frequency: merged.frequency,
      noteIds: [],
      size,
      color,
      confidence: merged.confidence,
      provenance: merged.provenance,
      alternateTypes: merged.alternateTypes.length > 0 ? merged.alternateTypes : undefined,
      blueprintTypeId: merged.blueprintTypeId || undefined,
      blueprintFields: merged.blueprintFields || undefined,
      isCanonical: merged.isCanonical,
    };
  }

  private determineNodeType(merged: MergedNode): GraphNodeType {
    if (merged.blueprintTypeId) return 'blueprint_entity';
    if (merged.sourceEntities.some(e => e.source === 'concept')) return 'concept';
    if (merged.isCanonical) return 'blueprint_entity';
    return 'extracted_entity';
  }

  mergeAll(entities: SyncEntity[]): GraphNode[] {
    const groups = this.groupByNormalizedName(entities);
    const nodes: GraphNode[] = [];

    for (const group of groups.values()) {
      const merged = this.mergeEntityGroup(group);
      nodes.push(this.toGraphNode(merged));
    }

    return nodes;
  }
}

export const nodeMerger = new NodeMerger();
