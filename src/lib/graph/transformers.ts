/**
 * Graph Transformers
 * 
 * Layer 3 of the Graph Visualization API.
 * Transforms enriched graph data to various visualization formats.
 */

import type { EnrichedNode, EnrichedEdge, EnrichedGraphData } from './enrichment';

// ===== TYPES =====

export type OutputFormat = 'cytoscape' | 'd3' | 'graphology' | 'raw';

// Cytoscape types
export interface CytoscapeNode {
    group: 'nodes';
    data: {
        id: string;
        label: string;
        parent?: string;
        color: string;
        size: number;
        shape: string;
        icon: string;
        entityKind?: string;
        [key: string]: any;
    };
    classes?: string;
    position?: { x: number; y: number };
}

export interface CytoscapeEdge {
    group: 'edges';
    data: {
        id: string;
        source: string;
        target: string;
        label?: string;
        color: string;
        width: number;
        edgeType: string;
        [key: string]: any;
    };
    classes?: string;
}

export type CytoscapeElements = {
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
};

// D3 types
export interface D3Node {
    id: string;
    label: string;
    color: string;
    size: number;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
    entityKind?: string;
    [key: string]: any;
}

export interface D3Link {
    id: string;
    source: string | D3Node;
    target: string | D3Node;
    value: number;
    color: string;
    edgeType: string;
    [key: string]: any;
}

export interface D3Graph {
    nodes: D3Node[];
    links: D3Link[];
}

// Graphology types (simplified)
export interface GraphologyData {
    nodes: Array<{
        key: string;
        attributes: Record<string, any>;
    }>;
    edges: Array<{
        key: string;
        source: string;
        target: string;
        attributes: Record<string, any>;
    }>;
}

// ===== TRANSFORMERS =====

/**
 * Transform to Cytoscape elements format
 */
export function toCytoscapeElements(data: EnrichedGraphData): CytoscapeElements {
    const nodes: CytoscapeNode[] = data.nodes.map(node => ({
        group: 'nodes',
        data: {
            id: node.id,
            label: node.label,
            parent: node.parentId || undefined,
            color: node.color,
            size: node.size,
            shape: node.shape,
            icon: node.icon,
            entityKind: node.entityKind,
            entitySubtype: node.entitySubtype,
            type: node.type,
            ...node.metadata,
        },
        classes: node.classes.join(' '),
    }));

    const edges: CytoscapeEdge[] = data.edges.map(edge => ({
        group: 'edges',
        data: {
            id: edge.id,
            source: edge.sourceId,
            target: edge.targetId,
            label: edge.label,
            color: edge.color,
            width: edge.width,
            edgeType: edge.edgeType,
            weight: edge.weight,
            confidence: edge.confidence,
            style: edge.style,
            ...edge.metadata,
        },
        classes: edge.classes.join(' '),
    }));

    return { nodes, edges };
}

/**
 * Transform to D3 force-directed graph format
 */
export function toD3Graph(data: EnrichedGraphData): D3Graph {
    const nodes: D3Node[] = data.nodes.map(node => ({
        id: node.id,
        label: node.label,
        color: node.color,
        size: node.size,
        entityKind: node.entityKind,
        entitySubtype: node.entitySubtype,
        type: node.type,
        classes: node.classes,
        ...node.metadata,
    }));

    const links: D3Link[] = data.edges.map(edge => ({
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        value: edge.weight ?? 1,
        color: edge.color,
        edgeType: edge.edgeType,
        confidence: edge.confidence,
        classes: edge.classes,
        ...edge.metadata,
    }));

    return { nodes, links };
}

/**
 * Transform to Graphology data format
 */
export function toGraphologyData(data: EnrichedGraphData): GraphologyData {
    const nodes = data.nodes.map(node => ({
        key: node.id,
        attributes: {
            label: node.label,
            color: node.color,
            size: node.size,
            shape: node.shape,
            icon: node.icon,
            type: node.type,
            entityKind: node.entityKind,
            entitySubtype: node.entitySubtype,
            classes: node.classes,
            ...node.metadata,
        },
    }));

    const edges = data.edges.map(edge => ({
        key: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        attributes: {
            type: edge.edgeType,
            weight: edge.weight ?? 1,
            color: edge.color,
            width: edge.width,
            style: edge.style,
            label: edge.label,
            confidence: edge.confidence,
            classes: edge.classes,
            ...edge.metadata,
        },
    }));

    return { nodes, edges };
}

// ===== LAYOUT HINTS =====

export interface LayoutHints {
    type: 'force' | 'hierarchical' | 'radial' | 'timeline' | 'grid';
    config: Record<string, any>;
}

/**
 * Generate layout hints based on graph structure
 */
export function suggestLayout(data: EnrichedGraphData): LayoutHints {
    const { nodes, edges } = data;

    // Check for hierarchical structure (many CONTAINS edges)
    const containsEdges = edges.filter(e => e.edgeType === 'CONTAINS').length;
    if (containsEdges > edges.length * 0.5) {
        return {
            type: 'hierarchical',
            config: {
                direction: 'TB',
                levelSep: 100,
                nodeSep: 50,
            },
        };
    }

    // Check for temporal structure (has temporal metadata)
    const hasTemporalData = nodes.some(n => n.metadata?.temporal || n.metadata?.createdAt);
    if (hasTemporalData) {
        return {
            type: 'timeline',
            config: {
                sorted: true,
                spacing: 150,
            },
        };
    }

    // Check for radial structure (single high-degree node)
    const degreeMap = new Map<string, number>();
    for (const edge of edges) {
        degreeMap.set(edge.sourceId, (degreeMap.get(edge.sourceId) || 0) + 1);
        degreeMap.set(edge.targetId, (degreeMap.get(edge.targetId) || 0) + 1);
    }
    const maxDegree = Math.max(...degreeMap.values());
    const avgDegree = nodes.length > 0 ?
        [...degreeMap.values()].reduce((a, b) => a + b, 0) / nodes.length : 0;

    if (maxDegree > avgDegree * 3 && maxDegree > 5) {
        const centralNode = [...degreeMap.entries()].find(([_, d]) => d === maxDegree)?.[0];
        return {
            type: 'radial',
            config: {
                center: centralNode,
                radius: 200,
            },
        };
    }

    // Default to force-directed layout
    return {
        type: 'force',
        config: {
            linkDistance: 100,
            chargeStrength: -300,
            collisionRadius: 30,
        },
    };
}

// ===== CYTOSCAPE STYLESHEET =====

/**
 * Generate Cytoscape stylesheet based on graph data
 */
export function generateCytoscapeStylesheet(): any[] {
    return [
        // Node base style
        {
            selector: 'node',
            style: {
                'label': 'data(label)',
                'text-valign': 'bottom',
                'text-margin-y': 5,
                'font-size': '10px',
                'background-color': 'data(color)',
                'width': 'data(size)',
                'height': 'data(size)',
                'border-width': 2,
                'border-color': '#ffffff20',
            },
        },
        // Entity nodes
        {
            selector: 'node.entity',
            style: {
                'font-weight': 'bold',
            },
        },
        // Folder nodes
        {
            selector: 'node.folder',
            style: {
                'shape': 'round-rectangle',
            },
        },
        // Selected node
        {
            selector: 'node:selected',
            style: {
                'border-width': 4,
                'border-color': '#fbbf24',
            },
        },
        // Edge base style
        {
            selector: 'edge',
            style: {
                'width': 'data(width)',
                'line-color': 'data(color)',
                'target-arrow-color': 'data(color)',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'opacity': 0.7,
            },
        },
        // Bidirectional edges
        {
            selector: 'edge.bidirectional',
            style: {
                'source-arrow-shape': 'triangle',
                'source-arrow-color': 'data(color)',
            },
        },
        // Co-occurrence edges
        {
            selector: 'edge.cooccurrence',
            style: {
                'line-style': 'dashed',
                'target-arrow-shape': 'none',
            },
        },
        // Selected edge
        {
            selector: 'edge:selected',
            style: {
                'width': 4,
                'opacity': 1,
            },
        },
    ];
}
