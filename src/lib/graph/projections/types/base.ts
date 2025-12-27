/**
 * Core Projection Interfaces
 * Base types for all graph projections regardless of the renderer.
 */

// Basic Node Structure (Renderer-Agnostic)
export interface ProjectionNode {
    id: string;
    label: string;
    type: string; // e.g., 'note', 'person', 'concept'

    // Visual properties
    color: string;
    size?: number;
    weight?: number; // Calculated importance/centrality

    // Metadata for tooltips/interaction
    metadata: Record<string, any>;

    // Position (optional, for pre-calculated layouts)
    x?: number;
    y?: number;
    z?: number;
}

// Basic Edge Structure (Renderer-Agnostic)
export interface ProjectionEdge<T = string> {
    id: string;
    source: T; // Node ID or Node Object
    target: T; // Node ID or Node Object
    type: string;   // e.g., 'links_to', 'MENTIONS', 'CO_OCCURS'

    // Visual properties
    weight?: number; // Thickness/strength
    color?: string;
    label?: string;

    // Metadata
    metadata: Record<string, any>;
}

// Statistical Overview of the Projection
export interface ProjectionStats {
    nodeCount: number;
    edgeCount: number;
    density: number; // 0-1
    clusterCount?: number;
    modularity?: number;
    averageDegree?: number;
}

// The Complete Projection Result
export interface GraphProjection<TScope = any> {
    nodes: ProjectionNode[];
    edges: ProjectionEdge[];
    stats: ProjectionStats;
    scope: TScope;
    timestamp: number;
}

// Cache Entry Structure
export interface ProjectionCacheEntry {
    key: string;
    data: GraphProjection;
    timestamp: number;
    ttl: number; // Time to live in ms
}

// ==================== Renderer-Specific Types ====================

// D3.js Compatible Types (2D)
export interface D3Node extends ProjectionNode {
    fx?: number | null; // Fixed X position
    fy?: number | null; // Fixed Y position
    vx?: number;        // Velocity X
    vy?: number;        // Velocity Y
    index?: number;
}

export interface D3Link extends ProjectionEdge<string | D3Node> {
    index?: number;
}

export interface D3GraphData {
    nodes: D3Node[];
    links: D3Link[];
}

// 3D Force Graph Compatible Types
export interface Force3DNode extends ProjectionNode {
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
    vx?: number;
    vy?: number;
    vz?: number;
}

export interface Force3DLink extends ProjectionEdge<string | Force3DNode> {
    curvature?: number;
    rotation?: number;
}

export interface Force3DGraphData {
    nodes: Force3DNode[];
    links: Force3DLink[];
}
