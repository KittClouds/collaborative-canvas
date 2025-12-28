/**
 * Graph Enrichment
 * 
 * Layer 2 of the Graph Visualization API.
 * Enriches raw graph data with visual metadata (colors, icons, labels).
 */

import { ENTITY_COLORS, EntityKind } from '@/lib/entities/entityTypes';
import type { RawNode, RawEdge, RawGraphData } from './data-providers';

// Icon name mapping (aligns with ENTITY_ICONS in entityTypes.ts)
const ENTITY_KIND_ICON_NAMES: Record<EntityKind, string> = {
    CHARACTER: 'User',
    LOCATION: 'MapPin',
    NPC: 'Users',
    ITEM: 'Package',
    FACTION: 'Flag',
    SCENE: 'Film',
    EVENT: 'Calendar',
    CONCEPT: 'Lightbulb',
    ARC: 'Waves',
    ACT: 'Drama',
    CHAPTER: 'BookOpen',
    BEAT: 'Zap',
    TIMELINE: 'Hourglass',
    NARRATIVE: 'Book',
    NETWORK: 'Network',
};

// ===== TYPES =====

export interface EnrichedNode extends RawNode {
    color: string;
    icon: string;
    size: number;
    shape: 'ellipse' | 'rectangle' | 'diamond' | 'hexagon';
    classes: string[];
}

export interface EnrichedEdge extends RawEdge {
    color: string;
    width: number;
    style: 'solid' | 'dashed' | 'dotted';
    label?: string;
    classes: string[];
}

export interface EnrichedGraphData {
    nodes: EnrichedNode[];
    edges: EnrichedEdge[];
    source: RawGraphData['source'];
    stats: RawGraphData['stats'];
}

// ===== CONFIGURATION =====

const NODE_TYPE_CONFIG: Record<string, { color: string; icon: string; shape: EnrichedNode['shape']; baseSize: number }> = {
    note: { color: '#6b7280', icon: 'FileText', shape: 'ellipse', baseSize: 20 },
    folder: { color: '#8b5cf6', icon: 'Folder', shape: 'rectangle', baseSize: 25 },
    entity: { color: '#3b82f6', icon: 'User', shape: 'ellipse', baseSize: 30 },
    concept: { color: '#10b981', icon: 'Lightbulb', shape: 'diamond', baseSize: 25 },
};

const EDGE_SOURCE_CONFIG: Record<string, { color: string; width: number; style: EnrichedEdge['style'] }> = {
    obsidian: { color: '#9ca3af', width: 1, style: 'solid' },
    folder: { color: '#a78bfa', width: 2, style: 'solid' },
    entity: { color: '#60a5fa', width: 2, style: 'solid' },
    cooccurrence: { color: '#34d399', width: 1, style: 'dashed' },
    network: { color: '#f472b6', width: 2, style: 'solid' },
};

const EDGE_TYPE_LABELS: Record<string, string> = {
    CONTAINS: '',
    WIKILINK: '→',
    MENTIONS: 'mentions',
    REFERENCE: 'ref',
    CO_OCCURS: '',
    PARENT_OF: 'parent',
    CHILD_OF: 'child',
    SPOUSE_OF: 'spouse',
    SIBLING_OF: 'sibling',
    ALLY_OF: 'ally',
    ENEMY_OF: 'enemy',
    MEMBER_OF: 'member',
    LOCATED_IN: 'at',
    OWNS: 'owns',
};

// ===== ENRICHMENT FUNCTIONS =====

/**
 * Enrich a single node with visual properties
 */
export function enrichNode(node: RawNode): EnrichedNode {
    const typeConfig = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.note;

    // Use entity-specific color if available
    let color = typeConfig.color;
    let icon = typeConfig.icon;

    if (node.entityKind) {
        color = ENTITY_COLORS[node.entityKind] || color;
        // ENTITY_ICONS contains React components, use icon name mapping instead
        icon = ENTITY_KIND_ICON_NAMES[node.entityKind] || icon;
    }

    // Override with metadata color if present
    if (node.metadata?.color) {
        color = node.metadata.color;
    }

    // Calculate size based on frequency/importance
    let size = typeConfig.baseSize;
    if (node.metadata?.frequency) {
        size = Math.min(50, typeConfig.baseSize + Math.log2(node.metadata.frequency) * 5);
    }

    // Build CSS classes
    const classes: string[] = [node.type];
    if (node.entityKind) {
        classes.push(`entity-${node.entityKind.toLowerCase()}`);
    }
    if (node.metadata?.isEntity) {
        classes.push('is-entity');
    }
    if (node.metadata?.favorite) {
        classes.push('favorite');
    }

    return {
        ...node,
        color,
        icon,
        size,
        shape: typeConfig.shape,
        classes,
    };
}

/**
 * Enrich a single edge with visual properties
 */
export function enrichEdge(edge: RawEdge): EnrichedEdge {
    const sourceConfig = EDGE_SOURCE_CONFIG[edge.source] || EDGE_SOURCE_CONFIG.obsidian;

    // Calculate width based on weight/confidence
    let width = sourceConfig.width;
    if (edge.weight && edge.weight > 1) {
        width = Math.min(5, sourceConfig.width + Math.log2(edge.weight));
    }
    if (edge.confidence && edge.confidence < 1) {
        width *= edge.confidence;
    }

    // Use dashed style for low-confidence edges
    let style = sourceConfig.style;
    if (edge.confidence && edge.confidence < 0.5) {
        style = 'dotted';
    } else if (edge.confidence && edge.confidence < 0.8) {
        style = 'dashed';
    }

    // Get edge label
    const label = EDGE_TYPE_LABELS[edge.edgeType];

    // Build CSS classes
    const classes: string[] = [edge.source, `edge-${edge.edgeType.toLowerCase()}`];
    if (edge.metadata?.bidirectional) {
        classes.push('bidirectional');
    }

    return {
        ...edge,
        color: sourceConfig.color,
        width,
        style,
        label,
        classes,
    };
}

/**
 * Enrich entire graph data
 */
export function enrichGraphData(data: RawGraphData): EnrichedGraphData {
    return {
        nodes: data.nodes.map(enrichNode),
        edges: data.edges.map(enrichEdge),
        source: data.source,
        stats: data.stats,
    };
}

// ===== SPECIALIZED ENRICHMENT =====

/**
 * Apply PageRank-based sizing to nodes
 */
export function applyPageRankSizing(
    nodes: EnrichedNode[],
    edges: EnrichedEdge[],
    dampingFactor: number = 0.85,
    iterations: number = 20
): void {
    const nodeCount = nodes.length;
    if (nodeCount === 0) return;

    // Initialize PageRank scores
    const scores = new Map<string, number>();
    const outDegree = new Map<string, number>();

    for (const node of nodes) {
        scores.set(node.id, 1 / nodeCount);
        outDegree.set(node.id, 0);
    }

    // Calculate out-degrees
    for (const edge of edges) {
        const current = outDegree.get(edge.sourceId) || 0;
        outDegree.set(edge.sourceId, current + 1);
    }

    // Build adjacency list
    const inLinks = new Map<string, string[]>();
    for (const node of nodes) {
        inLinks.set(node.id, []);
    }
    for (const edge of edges) {
        inLinks.get(edge.targetId)?.push(edge.sourceId);
    }

    // Iterate PageRank
    for (let i = 0; i < iterations; i++) {
        const newScores = new Map<string, number>();

        for (const node of nodes) {
            let sum = 0;
            const incomingNodes = inLinks.get(node.id) || [];

            for (const sourceId of incomingNodes) {
                const sourceScore = scores.get(sourceId) || 0;
                const sourceOut = outDegree.get(sourceId) || 1;
                sum += sourceScore / sourceOut;
            }

            newScores.set(node.id, (1 - dampingFactor) / nodeCount + dampingFactor * sum);
        }

        // Update scores
        for (const [id, score] of newScores) {
            scores.set(id, score);
        }
    }

    // Apply scores to node sizes
    const maxScore = Math.max(...scores.values());
    const minSize = 15;
    const maxSize = 60;

    for (const node of nodes) {
        const score = scores.get(node.id) || 0;
        const normalizedScore = maxScore > 0 ? score / maxScore : 0;
        node.size = minSize + normalizedScore * (maxSize - minSize);
    }
}

/**
 * Apply community-based coloring
 */
export function applyCommunityColors(
    nodes: EnrichedNode[],
    communities: Map<string, number>
): void {
    const communityColors = [
        '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
        '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
    ];

    for (const node of nodes) {
        const communityId = communities.get(node.id);
        if (communityId !== undefined) {
            node.color = communityColors[communityId % communityColors.length];
            node.classes.push(`community-${communityId}`);
        }
    }
}

/**
 * Filter edges by confidence threshold
 */
export function filterByConfidence(
    data: EnrichedGraphData,
    minConfidence: number
): EnrichedGraphData {
    const filteredEdges = data.edges.filter(
        e => (e.confidence ?? 1) >= minConfidence
    );

    // Only keep nodes that are connected
    const connectedIds = new Set<string>();
    for (const edge of filteredEdges) {
        connectedIds.add(edge.sourceId);
        connectedIds.add(edge.targetId);
    }

    const filteredNodes = data.nodes.filter(n => connectedIds.has(n.id));

    return {
        ...data,
        nodes: filteredNodes,
        edges: filteredEdges,
        stats: {
            ...data.stats,
            nodeCount: filteredNodes.length,
            edgeCount: filteredEdges.length,
        },
    };
}
