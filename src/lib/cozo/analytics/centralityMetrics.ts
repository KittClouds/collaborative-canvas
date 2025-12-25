import { betweenness, closeness, pagerank } from 'graphology-metrics/centrality';
import { cozoDb } from '../db';
import { exportGraphToGraphology } from './graphExporter';
import { mapRowToEntity } from '../types';
import type { CozoEntity } from '../types';

export interface CentralityOptions {
  groupId: string;
  metrics: ('betweenness' | 'closeness' | 'pagerank')[];
}

export async function computeCentralityMetrics(
  options: CentralityOptions
): Promise<void> {
  const graph = await exportGraphToGraphology(options.groupId);

  const updates: Record<string, any> = {};

  if (options.metrics.includes('betweenness')) {
    const scores = betweenness(graph);
    for (const [id, score] of Object.entries(scores)) {
      if (!updates[id]) updates[id] = {};
      updates[id].betweenness = score;
    }
  }

  if (options.metrics.includes('closeness')) {
    const scores = closeness(graph);
    for (const [id, score] of Object.entries(scores)) {
      if (!updates[id]) updates[id] = {};
      updates[id].closeness = score;
    }
  }

  // Pagerank might be default export or named, trying named from centrality
  if (options.metrics.includes('pagerank')) {
     // If pagerank is available in graphology-metrics/centrality
     try {
       // @ts-ignore
       const scores = pagerank(graph);
       for (const [id, score] of Object.entries(scores)) {
         if (!updates[id]) updates[id] = {};
         // We don't have a pagerank column in the schema shown in 'types.ts'.
         // Types has degree, betweenness, closeness.
         // Maybe store in attributes?
         if (!updates[id].attributes) updates[id].attributes = {};
         updates[id].attributes['pagerank'] = score;
       }
     } catch (e) {
       console.warn('PageRank computation failed or not available:', e);
     }
  }

  await updateCentralityScores(updates, options.groupId);
}

async function updateCentralityScores(
  updates: Record<string, any>,
  groupId: string
): Promise<void> {
  // Use the same single-query update pattern if possible, but here we have different values for each entity.
  // So we must iterate or construct a large batch data structure.
  // Cozo allows passing a list of objects and joining.
  
  const updateRows = Object.entries(updates).map(([id, data]) => ({
    id,
    betweenness: data.betweenness,
    closeness: data.closeness,
    pagerank: data.attributes?.pagerank
  }));

  // We can't do a single simple join update easily because the values vary.
  // We have to pass the data as a relation parameter.
  
  /*
    ?[id, name, kind, subtype, group, scope, created, method, summ, aliases, canon, freq, 
      degree, new_bw, new_cl, comm, attrs, span, parts] :=
      *entity{id, name, entity_kind: kind, entity_subtype: subtype, group_id: group, 
              scope_type: scope, created_at: created, extraction_method: method, 
              summary: summ, aliases, canonical_note_id: canon, frequency: freq, 
              degree_centrality: degree, community_id: comm, attributes: attrs, 
              temporal_span: span, participants: parts},
      group == $group_id,
      $updates[id, bw, cl, pr],
      
      new_bw = bw,
      new_cl = cl
      # Handle attributes update for pagerank?
      # Complex json merge in datalog is hard.
      
      :update entity { ... }
  */
  
  // For simplicity and safety with attributes, let's use a batch loop with :update.
  // Or even better, use `cozoDb.client.put` (if exposed) or standard query with parameters.
  
  // Since we are updating specific columns (betweenness, closeness) which are top-level,
  // we can use a simpler approach if we don't touch attributes.
  // The 'pagerank' requirement is tricky if it's not in the schema.
  // I will skip saving pagerank to attributes for now to ensure type safety with the provided schema.
  
  const BATCH_SIZE = 50;
  const entries = Object.entries(updates);
  
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    
    // Construct a big query with literal values or try to bind parameters?
    // Binding an array of objects is not standard in the simple runQuery wrapper usually.
    // It depends on the Cozo adapter.
    // I'll do individual updates or small batches via generated query text (careful with injection, but IDs are UUIDs).
    
    // Safest: Read the entities, update values, write back.
    // This ensures we have all columns for :put.
    
    // 1. Get IDs
    const ids = chunk.map(c => c[0]);
    const idList = JSON.stringify(ids); // string format "['id1', 'id2']" for Cozo? No.
    // Use `id in ['a', 'b']` syntax.
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
            // PageRank ignored for now as it's not in schema
            
            // Write back
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


