/**
 * Graph Types - Renderer-agnostic data structures for graph visualization
 * 
 * These types define the shape of data that flows from CozoDB to the renderers.
 * Both D3 and Force3D renderers consume this same structure.
 */

// ==================== Core Types ====================

/**
 * Renderer-agnostic node shape
 */
export interface GraphNode {
    id: string;
    label: string;
    type: string; // EntityKind or 'NOTE', 'FOLDER'
    color: string;
    size?: number;
    weight?: number; // Calculated importance/centrality
    metadata?: Record<string, any>;
}

/**
 * Renderer-agnostic edge shape
 */
export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: string; // 'CO_OCCURS', 'ALLY_OF', etc.
    weight?: number;
    color?: string;
    label?: string;
}

/**
 * Complete graph data structure
 * Uses 'links' property name for D3/Force3D compatibility
 */
export interface GraphData {
    nodes: GraphNode[];
    links: GraphEdge[];
}

/**
 * Graph statistics for UI display
 */
export interface GraphStats {
    nodeCount: number;
    edgeCount: number;
    density: number;
    averageDegree?: number;
}

// ==================== D3-Specific Extensions ====================

/**
 * D3.js compatible node (simulation adds position/velocity)
 */
export interface D3Node extends GraphNode {
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null; // Fixed X position
    fy?: number | null; // Fixed Y position
    index?: number;
}

/**
 * D3.js compatible link
 */
export interface D3Link extends GraphEdge {
    index?: number;
}

/**
 * D3 graph data structure
 */
export interface D3GraphData {
    nodes: D3Node[];
    links: D3Link[];
}

// ==================== Force3D-Specific Extensions ====================

/**
 * Force3D compatible node (adds z-axis)
 */
export interface Force3DNode extends GraphNode {
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
}

/**
 * Force3D compatible link
 */
export interface Force3DLink extends GraphEdge {
    curvature?: number;
    rotation?: number;
}

/**
 * Force3D graph data structure
 */
export interface Force3DGraphData {
    nodes: Force3DNode[];
    links: Force3DLink[];
}

// ==================== Scope Types ====================

/**
 * Graph scope determines what data to fetch
 */
export type GraphScope =
    | { type: 'global' }
    | { type: 'note'; noteId: string }
    | { type: 'folder'; folderId: string }
    | { type: 'entity'; entityId: string };

// ==================== Color Mapping ====================

/**
 * Default colors for entity kinds
 */
export const ENTITY_COLORS: Record<string, string> = {
    CHARACTER: '#f59e0b', // Amber
    LOCATION: '#3b82f6',  // Blue
    ITEM: '#10b981',      // Emerald
    EVENT: '#a855f7',     // Purple
    CONCEPT: '#6366f1',   // Indigo
    FACTION: '#ec4899',   // Pink
    NPC: '#f97316',       // Orange
    SCENE: '#14b8a6',     // Teal
    CHAPTER: '#8b5cf6',   // Violet
    ARC: '#ef4444',       // Red
    TIMELINE: '#06b6d4',  // Cyan
    NARRATIVE: '#84cc16', // Lime
    NOTE: '#71717a',      // Gray
    FOLDER: '#52525b',    // Darker gray
    DEFAULT: '#71717a',   // Gray
};

/**
 * Get color for an entity kind with fallback
 */
export function getEntityColor(kind: string): string {
    return ENTITY_COLORS[kind] || ENTITY_COLORS.DEFAULT;
}
