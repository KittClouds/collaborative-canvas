import { getGraph } from '@/lib/graph/graphInstance';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type { UnifiedNode, NodeType } from '@/lib/graph/types';
import type { EntityKind } from '@/lib/entities/entityTypes';

export interface FilterOptions {
  types?: NodeType[];
  entityKinds?: EntityKind[];
  tags?: string[];
  dateRange?: { from: Date; to: Date };
  hasLinks?: boolean;
  minDegree?: number;
  maxDegree?: number;
  customFilter?: (node: UnifiedNode) => boolean;
}

export interface AggregationResult {
  byType: Map<string, number>;
  byEntityKind: Map<string, number>;
  byTag: Map<string, number>;
  byDate: Map<string, number>;
  total: number;
}

export class FilterQueries {
  private graph: UnifiedGraph;

  constructor() {
    this.graph = getGraph();
  }

  filter(options: FilterOptions): UnifiedNode[] {
    const cy = this.graph.getInstance();
    let nodes = cy.nodes();

    if (options.types && options.types.length > 0) {
      nodes = nodes.filter((node: any) => {
        const type = node.data('type');
        return options.types!.includes(type);
      });
    }

    if (options.entityKinds && options.entityKinds.length > 0) {
      nodes = nodes.filter((node: any) => {
        const kind = node.data('entityKind');
        return kind && options.entityKinds!.includes(kind);
      });
    }

    if (options.tags && options.tags.length > 0) {
      nodes = nodes.filter((node: any) => {
        const nodeTags = node.data('tags') || [];
        return options.tags!.some(tag => nodeTags.includes(tag));
      });
    }

    if (options.dateRange) {
      const fromTime = options.dateRange.from.getTime();
      const toTime = options.dateRange.to.getTime();
      
      nodes = nodes.filter((node: any) => {
        const createdAt = node.data('createdAt');
        if (!createdAt) return false;
        return createdAt >= fromTime && createdAt <= toTime;
      });
    }

    if (options.hasLinks !== undefined) {
      nodes = nodes.filter((node: any) => {
        const hasEdges = node.degree() > 0;
        return options.hasLinks ? hasEdges : !hasEdges;
      });
    }

    if (options.minDegree !== undefined || options.maxDegree !== undefined) {
      nodes = nodes.filter((node: any) => {
        const degree = node.degree();
        if (options.minDegree !== undefined && degree < options.minDegree) return false;
        if (options.maxDegree !== undefined && degree > options.maxDegree) return false;
        return true;
      });
    }

    if (options.customFilter) {
      nodes = nodes.filter((node: any) => {
        const cyNode: UnifiedNode = { group: 'nodes', data: node.data() };
        return options.customFilter!(cyNode);
      });
    }

    return nodes.map((n: any) => ({ group: 'nodes', data: n.data() } as UnifiedNode)).toArray();
  }

  aggregate(nodes?: UnifiedNode[]): AggregationResult {
    const cy = this.graph.getInstance();
    const nodesToAggregate = nodes || cy.nodes().map((n: any) => ({ group: 'nodes', data: n.data() })).toArray();

    const result: AggregationResult = {
      byType: new Map(),
      byEntityKind: new Map(),
      byTag: new Map(),
      byDate: new Map(),
      total: nodesToAggregate.length,
    };

    nodesToAggregate.forEach(node => {
      const type = node.data.type;
      result.byType.set(type, (result.byType.get(type) || 0) + 1);

      if (node.data.entityKind) {
        const kind = node.data.entityKind;
        result.byEntityKind.set(kind, (result.byEntityKind.get(kind) || 0) + 1);
      }

      if (node.data.tags) {
        node.data.tags.forEach((tag: string) => {
          result.byTag.set(tag, (result.byTag.get(tag) || 0) + 1);
        });
      }

      if (node.data.createdAt) {
        const date = new Date(node.data.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        result.byDate.set(monthKey, (result.byDate.get(monthKey) || 0) + 1);
      }
    });

    return result;
  }

  getTopByDegree(limit: number = 10, options?: FilterOptions): UnifiedNode[] {
    const nodes = options ? this.filter(options) : this.graph.getNodesByType('NOTE');
    const cy = this.graph.getInstance();

    const nodesWithDegree = nodes.map(node => ({
      node,
      degree: cy.getElementById(node.data.id).degree(),
    }));

    nodesWithDegree.sort((a, b) => b.degree - a.degree);

    return nodesWithDegree.slice(0, limit).map(item => item.node);
  }

  getRecent(days: number = 7, options?: Omit<FilterOptions, 'dateRange'>): UnifiedNode[] {
    const now = new Date();
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return this.filter({
      ...options,
      dateRange: { from, to: now },
    });
  }

  getRecentlyModified(days: number = 7, options?: FilterOptions): UnifiedNode[] {
    const now = new Date();
    const fromTime = now.getTime() - days * 24 * 60 * 60 * 1000;

    return this.filter({
      ...options,
      customFilter: (node) => {
        const updatedAt = node.data.updatedAt;
        return updatedAt ? updatedAt >= fromTime : false;
      },
    });
  }

  getOrphans(options?: FilterOptions): UnifiedNode[] {
    return this.filter({
      ...options,
      hasLinks: false,
    });
  }

  getHubs(minDegree: number = 5, options?: Omit<FilterOptions, 'minDegree'>): UnifiedNode[] {
    return this.filter({
      ...options,
      minDegree,
    });
  }

  getByAllTags(tags: string[]): UnifiedNode[] {
    const cy = this.graph.getInstance();
    
    return cy.nodes()
      .filter((node: any) => {
        const nodeTags = node.data('tags') || [];
        return tags.every(tag => nodeTags.includes(tag));
      })
      .map((n: any) => ({ group: 'nodes', data: n.data() } as UnifiedNode))
      .toArray();
  }

  getByAnyTags(tags: string[]): UnifiedNode[] {
    return this.filter({ tags });
  }

  count(options: FilterOptions): number {
    return this.filter(options).length;
  }

  groupBy(field: keyof UnifiedNode['data']): Map<unknown, UnifiedNode[]> {
    const cy = this.graph.getInstance();
    const groups = new Map<unknown, UnifiedNode[]>();

    cy.nodes().forEach((node: any) => {
      const value = node.data(field as string);
      if (!groups.has(value)) {
        groups.set(value, []);
      }
      groups.get(value)!.push({ group: 'nodes', data: node.data() });
    });

    return groups;
  }
}

let filterQueries: FilterQueries | null = null;

export function getFilterQueries(): FilterQueries {
  if (!filterQueries) {
    filterQueries = new FilterQueries();
  }
  return filterQueries;
}
