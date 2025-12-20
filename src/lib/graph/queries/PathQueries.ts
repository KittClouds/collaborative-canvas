import { getGraph } from '@/lib/graph/graphInstance';
import { getTraversalQueries } from './TraversalQueries';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type { UnifiedNode, UnifiedEdge, NodeId } from '@/lib/graph/types';
import type { EntityKind } from '@/lib/entities/entityTypes';

export interface EntityPath {
  entities: UnifiedNode[];
  intermediateNodes: UnifiedNode[];
  edges: UnifiedEdge[];
  pathLength: number;
  pathType: 'direct' | 'through-note' | 'multi-hop';
}

export interface PathPattern {
  pattern: string;
  count: number;
  examples: EntityPath[];
}

export class PathQueries {
  private graph: UnifiedGraph;

  constructor() {
    this.graph = getGraph();
  }

  findEntityPaths(
    fromEntityId: NodeId,
    toEntityId: NodeId,
    options: {
      maxLength?: number;
      throughNotes?: boolean;
    } = {}
  ): EntityPath[] {
    const maxLength = options.maxLength || 5;
    const paths: EntityPath[] = [];
    const traversal = getTraversalQueries();

    const directPath = traversal.shortestPath(fromEntityId, toEntityId, {
      directed: false,
    });

    if (directPath && directPath.path.length <= maxLength + 1) {
      paths.push(this.classifyPath(directPath.path));
    }

    if (options.throughNotes) {
      const notePaths = this.findPathsThroughNotes(fromEntityId, toEntityId, maxLength);
      paths.push(...notePaths);
    }

    return paths;
  }

  private findPathsThroughNotes(
    fromEntityId: NodeId,
    toEntityId: NodeId,
    maxLength: number
  ): EntityPath[] {
    const cy = this.graph.getInstance();
    const paths: EntityPath[] = [];
    const traversal = getTraversalQueries();

    const fromNode = cy.getElementById(fromEntityId);
    const fromNotes = fromNode.neighborhood().nodes().filter((n: any) => n.data('type') === 'NOTE');

    const toNode = cy.getElementById(toEntityId);
    const toNotes = toNode.neighborhood().nodes().filter((n: any) => n.data('type') === 'NOTE');

    const commonNotes = fromNotes.intersection(toNotes);
    
    commonNotes.forEach((note: any) => {
      const path: UnifiedNode[] = [
        { group: 'nodes', data: fromNode.data() },
        { group: 'nodes', data: note.data() },
        { group: 'nodes', data: toNode.data() },
      ];

      paths.push(this.classifyPath(path));
    });

    if (maxLength >= 4) {
      fromNotes.forEach((fromNote: any) => {
        toNotes.forEach((toNote: any) => {
          if (fromNote.id() === toNote.id()) return;

          const notePath = traversal.shortestPath(fromNote.id(), toNote.id(), {
            directed: false,
          });

          if (notePath && notePath.path.length + 2 <= maxLength) {
            const fullPath: UnifiedNode[] = [
              { group: 'nodes', data: fromNode.data() },
              ...notePath.path,
              { group: 'nodes', data: toNode.data() },
            ];

            paths.push(this.classifyPath(fullPath));
          }
        });
      });
    }

    return paths;
  }

  private classifyPath(pathNodes: UnifiedNode[]): EntityPath {
    const entities = pathNodes.filter(n => n.data.type === 'ENTITY');
    const notes = pathNodes.filter(n => n.data.type === 'NOTE');
    
    const cy = this.graph.getInstance();
    const edges: UnifiedEdge[] = [];

    for (let i = 0; i < pathNodes.length - 1; i++) {
      const source = pathNodes[i].data.id;
      const target = pathNodes[i + 1].data.id;
      
      const sourceNode = cy.getElementById(source);
      const edgeCollection = sourceNode.edgesWith(cy.getElementById(target));
      
      if (edgeCollection.length) {
        edges.push({ group: 'edges', data: edgeCollection.first().data() });
      }
    }

    let pathType: EntityPath['pathType'] = 'multi-hop';
    
    if (pathNodes.length === 2) {
      pathType = 'direct';
    } else if (pathNodes.length === 3 && notes.length === 1) {
      pathType = 'through-note';
    }

    return {
      entities,
      intermediateNodes: pathNodes.slice(1, -1),
      edges,
      pathLength: pathNodes.length - 1,
      pathType,
    };
  }

  getEntitiesThroughNote(noteId: NodeId): UnifiedNode[] {
    const cy = this.graph.getInstance();
    const note = cy.getElementById(noteId);

    if (!note.length || note.data('type') !== 'NOTE') return [];

    return note.neighborhood()
      .nodes()
      .filter((n: any) => n.data('type') === 'ENTITY')
      .map((n: any) => ({ group: 'nodes', data: n.data() } as UnifiedNode))
      .toArray();
  }

  findCommonNotes(entityIds: NodeId[]): UnifiedNode[] {
    if (entityIds.length === 0) return [];

    const cy = this.graph.getInstance();
    let commonNotes = cy.getElementById(entityIds[0])
      .neighborhood()
      .nodes()
      .filter((n: any) => n.data('type') === 'NOTE');

    for (let i = 1; i < entityIds.length; i++) {
      const entityNotes = cy.getElementById(entityIds[i])
        .neighborhood()
        .nodes()
        .filter((n: any) => n.data('type') === 'NOTE');
      commonNotes = commonNotes.intersection(entityNotes);
    }

    return commonNotes
      .map((n: any) => ({ group: 'nodes', data: n.data() } as UnifiedNode))
      .toArray();
  }

  analyzePathPatterns(options: {
    entityKinds?: EntityKind[];
    maxLength?: number;
    sampleSize?: number;
  } = {}): PathPattern[] {
    const cy = this.graph.getInstance();
    const patterns = new Map<string, EntityPath[]>();
    
    let entities = cy.nodes().filter((n: any) => n.data('type') === 'ENTITY');
    
    if (options.entityKinds) {
      entities = entities.filter((n: any) => 
        options.entityKinds!.includes(n.data('entityKind'))
      );
    }

    const entityArray = entities.toArray();
    const sampleSize = Math.min(options.sampleSize || 100, entityArray.length * (entityArray.length - 1) / 2);
    
    const pairs: Array<[any, any]> = [];
    for (let i = 0; i < sampleSize; i++) {
      const idx1 = Math.floor(Math.random() * entityArray.length);
      const idx2 = Math.floor(Math.random() * entityArray.length);
      
      if (idx1 !== idx2) {
        pairs.push([entityArray[idx1], entityArray[idx2]]);
      }
    }

    pairs.forEach(([from, to]) => {
      const entityPaths = this.findEntityPaths(from.id(), to.id(), {
        maxLength: options.maxLength || 5,
        throughNotes: true,
      });

      entityPaths.forEach(path => {
        const pattern = this.pathToPattern(path);
        if (!patterns.has(pattern)) {
          patterns.set(pattern, []);
        }
        patterns.get(pattern)!.push(path);
      });
    });

    return Array.from(patterns.entries())
      .map(([pattern, examples]) => ({
        pattern,
        count: examples.length,
        examples: examples.slice(0, 5),
      }))
      .sort((a, b) => b.count - a.count);
  }

  private pathToPattern(path: EntityPath): string {
    const nodes = [path.entities[0], ...path.intermediateNodes, path.entities[path.entities.length - 1]];
    
    return nodes
      .map(n => {
        if (n.data.type === 'ENTITY') {
          return n.data.entityKind || 'ENTITY';
        }
        return n.data.type;
      })
      .join('->');
  }

  getEntityDistance(entityId1: NodeId, entityId2: NodeId): number | null {
    const traversal = getTraversalQueries();
    const path = traversal.shortestPath(entityId1, entityId2, {
      directed: false,
    });

    return path ? path.distance : null;
  }

  findEntityClusters(minCoOccurrence: number = 2): Array<{
    entities: UnifiedNode[];
    sharedNotes: UnifiedNode[];
    strength: number;
  }> {
    const cy = this.graph.getInstance();
    const clusters: Array<{
      entities: UnifiedNode[];
      sharedNotes: UnifiedNode[];
      strength: number;
    }> = [];

    const entities = cy.nodes().filter((n: any) => n.data('type') === 'ENTITY').toArray();

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const sharedNotes = this.findCommonNotes([entities[i].id(), entities[j].id()]);
        
        if (sharedNotes.length >= minCoOccurrence) {
          clusters.push({
            entities: [
              { group: 'nodes', data: entities[i].data() },
              { group: 'nodes', data: entities[j].data() },
            ],
            sharedNotes,
            strength: sharedNotes.length,
          });
        }
      }
    }

    return clusters.sort((a, b) => b.strength - a.strength);
  }
}

let pathQueries: PathQueries | null = null;

export function getPathQueries(): PathQueries {
  if (!pathQueries) {
    pathQueries = new PathQueries();
  }
  return pathQueries;
}
