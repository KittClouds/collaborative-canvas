// Inline types since projections/types/base doesn't exist
interface GraphProjection {
    nodes: Array<{ id: string; type: string; weight?: number;[key: string]: any }>;
    edges: Array<{ source: string | object; target: string | object;[key: string]: any }>;
}

interface D3Node {
    id: string;
    type: string;
    weight?: number;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
    [key: string]: any;
}

interface D3Link {
    source: string | D3Node;
    target: string | D3Node;
    [key: string]: any;
}

interface D3GraphData {
    nodes: D3Node[];
    links: D3Link[];
}

export class D3Renderer {
    /**
     * Transforms a generic GraphProjection into D3-compatible data structure.
     * D3 modifies node objects in place, so we create a deep copy or specifically mapped objects.
     */
    static render(projection: GraphProjection): D3GraphData {
        // Map Nodes
        // We add d3 specific fields optional initialization (d3 will automate them)
        const nodes: D3Node[] = projection.nodes.map(node => ({
            ...node,
            // D3 specific property placeholders if we wanted to pre-calculate, 
            // but usually simulation does it.
            // We ensure 'id' is present as D3 forces generally use 'id' or 'index'
        }));

        // Map Edges
        // Important: D3 forceSimulation expects links.source and links.target 
        // to be either ID strings OR Node objects.
        // If we pass strings, we must specify .id() accessor in simulation.
        // We pass strings here (from projection) and rely on simulation configuration.
        const links: D3Link[] = projection.edges.map(edge => ({
            ...edge,
            // Ensure source/target are primitives corresponding to node ids
            source: edge.source as string,
            target: edge.target as string
        }));

        return { nodes, links };
    }
}
