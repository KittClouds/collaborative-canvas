import { useState, useMemo } from 'react';
import { GraphProjection } from '../lib/graph/projections/types/base';

export interface FilterState {
    entityTypes: string[];
    minWeight: number;
    dateRange: [number, number] | null;
}

export function useGraphFilters(projection: GraphProjection | null) {
    const [filters, setFilters] = useState<FilterState>({
        entityTypes: [],
        minWeight: 0,
        dateRange: null,
    });

    const filteredData = useMemo(() => {
        if (!projection) return { nodes: [], edges: [] };

        let nodes = projection.nodes;
        let edges = projection.edges;

        if (filters.entityTypes.length > 0) {
            nodes = nodes.filter(n => filters.entityTypes.includes(n.type));
        }

        if (filters.minWeight > 0) {
            nodes = nodes.filter(n => (n.weight || 0) >= filters.minWeight);
        }

        // Filter edges to ensure both source/target exist in filtered nodes set
        const nodeIds = new Set(nodes.map(n => n.id));
        edges = edges.filter(e =>
            nodeIds.has(e.source as string) && nodeIds.has(e.target as string)
        );

        return { nodes, edges };
    }, [projection, filters]);

    return { filters, setFilters, filteredData };
}
