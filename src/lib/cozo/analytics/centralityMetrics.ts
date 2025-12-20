import { cozoDb } from '../db';
import { exportGraphToUnified } from './graphExporter';
import { mapRowToEntity } from '../types';

export interface CentralityOptions {
  groupId: string;
  metrics: ('betweenness' | 'closeness' | 'degree')[];
}

export async function computeCentralityMetrics(
  options: CentralityOptions
): Promise<void> {
  const graph = await exportGraphToUnified(options.groupId);
  
  const updates: Record<string, { betweenness?: number; closeness?: number; degree?: number }> = {};

  if (options.metrics.includes('betweenness')) {
    const scores = graph.computeBetweenness();
    scores.forEach((score, id) => {
      if (!updates[id]) updates[id] = {};
      updates[id].betweenness = score;
    });
  }

  if (options.metrics.includes('closeness')) {
    const scores = graph.computeCloseness();
    scores.forEach((score, id) => {
      if (!updates[id]) updates[id] = {};
      updates[id].closeness = score;
    });
  }

  if (options.metrics.includes('degree')) {
    const scores = graph.computeDegrees();
    scores.forEach((score, id) => {
      if (!updates[id]) updates[id] = {};
      updates[id].degree = score;
    });
  }

  await updateCentralityScores(updates, options.groupId);
  
  graph.destroy();
}

async function updateCentralityScores(
  updates: Record<string, { betweenness?: number; closeness?: number; degree?: number }>,
  groupId: string
): Promise<void> {
  const BATCH_SIZE = 50;
  const entries = Object.entries(updates);
  
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    
    const ids = chunk.map(c => c[0]);
    const idStr = ids.map(id => `'${id}'`).join(', ');
    
    const readQuery = `
      ?[id, name, kind, subtype, group, scope, created, method, summ, aliases, canon, freq, 
        degree, bw, cl, comm, attrs, span, parts] :=
        *entity{id, name, entity_kind: kind, entity_subtype: subtype, group_id: group, 
                scope_type: scope, created_at: created, extraction_method: method, 
                summary: summ, aliases, canonical_note_id: canon, frequency: freq, 
                degree_centrality: degree, betweenness_centrality: bw, 
                closeness_centrality: cl, community_id: comm, attributes: attrs, 
                temporal_span: span, participants: parts},
        id in [${idStr}]
    `;
    
    try {
      const result = cozoDb.runQuery(readQuery, {});
      if (result.rows) {
        for (const row of result.rows) {
          const entity = mapRowToEntity(row);
          const update = updates[entity.id];
          
          if (update) {
            if (update.betweenness !== undefined) entity.betweennessCentrality = update.betweenness;
            if (update.closeness !== undefined) entity.closenessCentrality = update.closeness;
            if (update.degree !== undefined) entity.degreeCentrality = update.degree;
            
            const writeQuery = `
              ?[id, name, kind, subtype, group, scope, created, method, summ, aliases, canon, freq, 
                degree, bw, cl, comm, attrs, span, parts] <- [[
                $id, $name, $kind, $subtype, $group, $scope, $created, $method, $summ, $aliases, 
                $canon, $freq, $degree, $bw, $cl, $comm, $attrs, $span, $parts
              ]]
              :put entity {
                id, name, entity_kind: kind, entity_subtype: subtype, group_id: group, 
                scope_type: scope, created_at: created, extraction_method: method, 
                summary: summ, aliases, canonical_note_id: canon, frequency: freq, 
                degree_centrality: degree, betweenness_centrality: bw, 
                closeness_centrality: cl, community_id: comm, attributes: attrs, 
                temporal_span: span, participants: parts
              }
            `;
            
            cozoDb.runQuery(writeQuery, {
              id: entity.id,
              name: entity.name,
              kind: entity.entityKind,
              subtype: entity.entitySubtype,
              group: entity.groupId,
              scope: entity.scopeType,
              created: entity.createdAt.getTime(),
              method: entity.extractionMethod,
              summ: entity.summary,
              aliases: entity.aliases,
              canon: entity.canonicalNoteId,
              freq: entity.frequency,
              degree: entity.degreeCentrality,
              bw: entity.betweennessCentrality,
              cl: entity.closenessCentrality,
              comm: entity.communityId,
              attrs: entity.attributes,
              span: entity.temporalSpan,
              parts: entity.participants
            });
          }
        }
      }
    } catch (e) {
      console.error('Error updating centrality batch', e);
    }
  }
}
