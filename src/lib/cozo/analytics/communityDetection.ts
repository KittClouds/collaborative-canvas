import louvain from 'graphology-communities-louvain';
import { cozoDb } from '../db';
import { exportGraphToGraphology } from './graphExporter';
import { mapRowToEntity } from '../types';

export interface CommunityDetectionOptions {
  groupId: string;
  resolution?: number; // For multi-scale community detection (if supported)
}

export interface CommunityResult {
  communities: number;
  modularity: number;
}

export async function detectCommunities(
  options: CommunityDetectionOptions
): Promise<CommunityResult> {
  const graph = await exportGraphToGraphology(options.groupId);

  if (graph.order === 0) {
    return { communities: 0, modularity: 0 };
  }

  // Run Louvain
  // 'detailed' returns metrics and the mapping
  const details = louvain.detailed(graph, {
    resolution: options.resolution || 1.0
  });

  const communityCount = details.count;
  const modularity = details.modularity;

  // Extract assignments and update Cozo
  const updates: Record<string, string> = {};

  Object.entries(details.communities).forEach(([node, community]) => {
    updates[node] = String(community);
  });

  await updateCommunities(updates, options.groupId);

  return {
    communities: communityCount,
    modularity: modularity
  };
}

async function updateCommunities(
  updates: Record<string, string>,
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
          const newComm = updates[entity.id];

          if (newComm !== undefined && newComm !== entity.communityId) {
            // Update needed
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
              comm: newComm, // Update this
              attrs: entity.attributes,
              span: entity.temporalSpan,
              parts: entity.participants
            });
          }
        }
      }
    } catch (e) {
      console.error('Error updating community batch', e);
    }
  }
}
