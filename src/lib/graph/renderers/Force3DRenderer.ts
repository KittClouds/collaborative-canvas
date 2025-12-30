// Inline types since projections/types/base doesn't exist
interface GraphProjection {
    nodes: Array<{ id: string; type: string; weight?: number;[key: string]: any }>;
    edges: Array<{ source: string | object; target: string | object;[key: string]: any }>;
}

interface Force3DNode {
    id: string;
    type: string;
    weight?: number;
    x?: number;
    y?: number;
    z?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
    [key: string]: any;
}

interface Force3DLink {
    source: string | Force3DNode;
    target: string | Force3DNode;
    curvature?: number;
    rotation?: number;
    [key: string]: any;
}

interface Force3DGraphData {
    nodes: Force3DNode[];
    links: Force3DLink[];
}

export class Force3DRenderer {
    /**
     * Transforms generic GraphProjection into 3D-force-graph compatible data.
     */
    static render(projection: GraphProjection): Force3DGraphData {
        // Map Nodes
        const nodes: Force3DNode[] = projection.nodes.map(node => ({
            ...node,
            // 3D Specific defaults
            fz: 0 // Start on plane, let force engine move them or use layout
        }));

        // Map Edges
        const links: Force3DLink[] = projection.edges.map(edge => ({
            ...edge,
            source: edge.source as string,
            target: edge.target as string,
            // Default value for 3D specific attrs
            curvature: 0.1, // Slight curve helps visual depth perception
            rotation: 0
        }));

        return { nodes, links };
    }
}
