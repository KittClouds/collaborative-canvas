import { GraphProjection, Force3DGraphData, Force3DNode, Force3DLink } from '../projections/types/base';

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
