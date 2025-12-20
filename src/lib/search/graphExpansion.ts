import { getGraph } from '@/lib/graph/graphInstance';
import { getTraversalQueries } from '@/lib/graph/queries/TraversalQueries';
import type { VectorSearchResult } from './vectorSearch';

export interface GraphExpansionOptions {
  maxHops: number;
  maxExpanded: number;
  minCooccurrence: number;
}

export interface ExpandedResult extends VectorSearchResult {
  expansionReason?: string;
  graphDistance?: number;
  connectedEntities?: string[];
}

export async function expandResultsViaGraph(
  vectorResults: VectorSearchResult[],
  options: GraphExpansionOptions
): Promise<ExpandedResult[]> {
  if (vectorResults.length === 0) return [];

  const graph = getGraph();
  const cy = graph.getInstance();
  const noteIds = vectorResults.map(r => r.noteId);

  const mentionedEntityIds: string[] = [];
  
  try {
    const mentionEdges = cy.edges().filter(e => {
      const data = e.data();
      return noteIds.includes(data.source) && data.type === 'MENTIONS';
    });

    mentionEdges.forEach(edge => {
      const targetId = edge.data('target');
      if (!mentionedEntityIds.includes(targetId)) {
        mentionedEntityIds.push(targetId);
      }
    });
  } catch (e) {
    console.warn('Could not fetch entity mentions, skipping graph expansion:', e);
    return vectorResults.map(r => ({ ...r, graphDistance: 0 }));
  }

  if (mentionedEntityIds.length === 0) {
    return vectorResults.map(r => ({ ...r, graphDistance: 0 }));
  }

  const connectedEntityIds: string[] = [];
  const entityDistances: Record<string, number> = {};

  try {
    for (const entityId of mentionedEntityIds) {
      entityDistances[entityId] = 0;
      
      const entityNode = cy.getElementById(entityId);
      if (!entityNode.length) continue;

      const neighbors = entityNode.neighborhood().nodes().filter(n => {
        return n.data('type') === 'ENTITY';
      });

      neighbors.forEach(neighbor => {
        const neighborId = neighbor.id();
        if (!mentionedEntityIds.includes(neighborId) && !connectedEntityIds.includes(neighborId)) {
          connectedEntityIds.push(neighborId);
          entityDistances[neighborId] = 1;
        }
      });

      if (options.maxHops >= 2) {
        neighbors.forEach(neighbor => {
          const hop2Neighbors = neighbor.neighborhood().nodes().filter(n => {
            return n.data('type') === 'ENTITY';
          });
          
          hop2Neighbors.forEach(h2 => {
            const h2Id = h2.id();
            if (!mentionedEntityIds.includes(h2Id) && 
                !connectedEntityIds.includes(h2Id) && 
                entityDistances[h2Id] === undefined) {
              connectedEntityIds.push(h2Id);
              entityDistances[h2Id] = 2;
            }
          });
        });
      }
    }
  } catch (e) {
    console.warn('Graph traversal failed:', e);
  }

  const expandedNoteIds = new Set<string>();
  const noteEntityMap: Record<string, string[]> = {};

  try {
    for (const entityId of [...mentionedEntityIds, ...connectedEntityIds]) {
      const incomingEdges = cy.edges().filter(e => {
        const data = e.data();
        return data.target === entityId && data.type === 'MENTIONS';
      });

      incomingEdges.forEach(edge => {
        const sourceNoteId = edge.data('source');
        if (!noteIds.includes(sourceNoteId)) {
          expandedNoteIds.add(sourceNoteId);
          if (!noteEntityMap[sourceNoteId]) {
            noteEntityMap[sourceNoteId] = [];
          }
          noteEntityMap[sourceNoteId].push(entityId);
        }
      });
    }
  } catch (e) {
    console.warn('Failed to find connected notes:', e);
  }

  const resultsMap = new Map<string, ExpandedResult>();

  for (const result of vectorResults) {
    resultsMap.set(result.noteId, {
      ...result,
      graphDistance: 0,
      connectedEntities: [],
    });
  }

  let expandedCount = 0;
  for (const noteId of expandedNoteIds) {
    if (expandedCount >= options.maxExpanded - vectorResults.length) break;
    if (resultsMap.has(noteId)) continue;

    const entities = noteEntityMap[noteId] || [];
    const minDistance = Math.min(
      ...entities.map(e => entityDistances[e] ?? Infinity)
    );

    if (minDistance === Infinity) continue;

    const expansionScore = 0.5 / (1 + minDistance);

    resultsMap.set(noteId, {
      noteId,
      score: expansionScore,
      graphDistance: minDistance,
      connectedEntities: entities,
      expansionReason: `Connected via ${entities.length} shared entities`,
    });

    expandedCount++;
  }

  return Array.from(resultsMap.values());
}
