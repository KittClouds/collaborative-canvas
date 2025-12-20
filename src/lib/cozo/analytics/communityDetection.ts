import { cozoDb } from '../db';
import { exportGraphToUnified } from './graphExporter';
import { mapRowToEntity } from '../types';

export interface CommunityDetectionOptions {
  groupId: string;
  resolution?: number;
}

export interface CommunityResult {
  communities: number;
  modularity: number;
}

export async function detectCommunities(
  options: CommunityDetectionOptions
): Promise<CommunityResult> {
  const graph = await exportGraphToUnified(options.groupId);
  const cy = graph.getInstance();

  if (cy.nodes().length === 0) {
    graph.destroy();
    return { communities: 0, modularity: 0 };
  }

  const communities = graph.detectCommunities();
  const uniqueCommunities = new Set(communities.values());
  const communityCount = uniqueCommunities.size;

  const modularity = calculateModularity(graph, communities);

  await updateCommunities(Object.fromEntries(communities), options.groupId);

  graph.destroy();

  return {
    communities: communityCount,
    modularity: modularity
  };
}

function calculateModularity(
  graph: import('@/lib/graph/UnifiedGraph').UnifiedGraph,
  communities: Map<string, string>
): number {
  const cy = graph.getInstance();
  const m = cy.edges().length;
  if (m === 0) return 0;

  let q = 0;
  const nodes = cy.nodes();

  nodes.forEach(nodeI => {
    nodes.forEach(nodeJ => {
      if (communities.get(nodeI.id()) === communities.get(nodeJ.id())) {
        const aij = nodeI.edgesWith(nodeJ).length > 0 ? 1 : 0;
        const ki = nodeI.degree(false);
        const kj = nodeJ.degree(false);
        q += aij - (ki * kj) / (2 * m);
      }
    });
  });

  return q / (2 * m);
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
              comm: newComm,
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
