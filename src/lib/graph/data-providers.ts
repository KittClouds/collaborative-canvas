/**
 * Graph Data Providers
 * 
 * Layer 1 of the Graph Visualization API.
 * Provides scope-specific query functions for retrieving graph data
 * from CozoDB and SQLite.
 */

import { cozoDb } from '@/lib/cozo/db';
import { dbClient } from '@/lib/db/client/db-client';
import { linkIndex } from '@/lib/linking/LinkIndex';
import { UNIFIED_EDGE_QUERIES } from '@/lib/cozo/schema/layer2-unified-edges';
import type { EntityKind } from '@/lib/entities/entityTypes';

// ===== TYPES =====

export type GraphScope = 'vault' | 'folder' | 'note' | 'selection' | 'network';

export interface GraphFilter {
    scope: GraphScope;
    scopeIds?: string[];
    entityKinds?: EntityKind[];
    edgeTypes?: string[];
    minConfidence?: number;
    includeHidden?: boolean;
    limit?: number;
}

export interface RawNode {
    id: string;
    label: string;
    type: 'note' | 'folder' | 'entity' | 'concept';
    entityKind?: EntityKind;
    entitySubtype?: string;
    parentId?: string | null;
    metadata?: Record<string, any>;
}

export interface RawEdge {
    id: string;
    sourceId: string;
    targetId: string;
    edgeType: string;
    weight?: number;
    confidence?: number;
    source: 'obsidian' | 'entity' | 'cooccurrence' | 'network' | 'folder';
    metadata?: Record<string, any>;
}

export interface RawGraphData {
    nodes: RawNode[];
    edges: RawEdge[];
    source: 'obsidian' | 'entity' | 'cooccurrence' | 'unified';
    stats: {
        nodeCount: number;
        edgeCount: number;
        queryTimeMs: number;
    };
}

// ===== SCOPE 1: OBSIDIAN (Notes, Folders, Links) =====

/**
 * Get graph data from SQLite (notes, folders) + LinkIndex (wikilinks, backlinks)
 */
export async function getObsidianGraphData(filter: GraphFilter): Promise<RawGraphData> {
    const startTime = performance.now();
    const nodes: RawNode[] = [];
    const edges: RawEdge[] = [];

    try {
        // Get all notes and folders from SQLite
        const allNodes = await dbClient.getAllNodes();

        // Filter by scope
        let filteredNodes = allNodes;
        if (filter.scope === 'folder' && filter.scopeIds?.length) {
            const folderIds = new Set(filter.scopeIds);
            const descendantIds = new Set<string>();

            // BFS to find all descendants
            const queue = [...filter.scopeIds];
            while (queue.length > 0) {
                const currentId = queue.shift()!;
                descendantIds.add(currentId);

                const children = allNodes.filter(n => n.parent_id === currentId);
                for (const child of children) {
                    if (!descendantIds.has(child.id)) {
                        queue.push(child.id);
                    }
                }
            }

            filteredNodes = allNodes.filter(n => descendantIds.has(n.id) || folderIds.has(n.id));
        } else if (filter.scope === 'note' && filter.scopeIds?.length) {
            const noteIds = new Set(filter.scopeIds);
            filteredNodes = allNodes.filter(n => noteIds.has(n.id));
        }

        // Convert to RawNode format
        for (const node of filteredNodes) {
            nodes.push({
                id: node.id,
                label: node.label || 'Untitled',
                type: node.type === 'FOLDER' ? 'folder' : 'note',
                entityKind: node.entity_kind as EntityKind | undefined,
                entitySubtype: node.entity_subtype || undefined,
                parentId: node.parent_id,
                metadata: {
                    isEntity: node.is_entity,
                    favorite: node.favorite,
                    createdAt: node.created_at,
                    updatedAt: node.updated_at,
                },
            });

            // Add folder hierarchy edges
            if (node.parent_id) {
                edges.push({
                    id: `folder-${node.parent_id}-${node.id}`,
                    sourceId: node.parent_id,
                    targetId: node.id,
                    edgeType: 'CONTAINS',
                    weight: 1,
                    confidence: 1,
                    source: 'folder',
                });
            }
        }

        // Add link edges from LinkIndex
        const nodeIds = new Set(nodes.map(n => n.id));

        for (const node of filteredNodes) {
            if (node.type !== 'NOTE') continue;

            const outgoingLinks = linkIndex.getOutgoingLinks(node.id);

            for (const link of outgoingLinks) {
                // Find target note by title
                const targetNode = filteredNodes.find(
                    n => n.label?.toLowerCase() === link.targetTitle.toLowerCase()
                );

                if (targetNode && nodeIds.has(targetNode.id)) {
                    edges.push({
                        id: `link-${node.id}-${targetNode.id}-${link.linkType}`,
                        sourceId: node.id,
                        targetId: targetNode.id,
                        edgeType: link.linkType === 'wikilink' ? 'WIKILINK' :
                            link.linkType === 'entity' ? 'MENTIONS' : 'REFERENCE',
                        weight: 1,
                        confidence: 1,
                        source: 'obsidian',
                        metadata: {
                            linkType: link.linkType,
                            entityKind: link.entityKind,
                            context: link.context,
                        },
                    });
                }
            }
        }

    } catch (err) {
        console.error('[DataProviders] Obsidian graph error:', err);
    }

    return {
        nodes,
        edges,
        source: 'obsidian',
        stats: {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            queryTimeMs: performance.now() - startTime,
        },
    };
}

// ===== SCOPE 2: ENTITY GRAPH =====

/**
 * Get entity graph data from CozoDB (entities + relationships)
 */
export async function getEntityGraphData(filter: GraphFilter): Promise<RawGraphData> {
    const startTime = performance.now();
    const nodes: RawNode[] = [];
    const edges: RawEdge[] = [];

    try {
        // Build entity query with filters
        let entityQuery = `?[id, label, normalized, kind, subtype, first_note, created_at] := 
            *entities{id, label, normalized, kind, subtype, first_note, created_at}`;

        const params: Record<string, any> = {};
        const whereClauses: string[] = [];

        if (filter.entityKinds?.length) {
            // Use OR for multiple kinds
            const kindConditions = filter.entityKinds.map((_, i) => `kind == $kind_${i}`).join(' or ');
            whereClauses.push(`(${kindConditions})`);
            filter.entityKinds.forEach((kind, i) => {
                params[`kind_${i}`] = kind;
            });
        }

        if (whereClauses.length > 0) {
            entityQuery += `, ${whereClauses.join(', ')}`;
        }

        if (filter.limit) {
            entityQuery += ` :limit ${filter.limit}`;
        }

        const entityResult = cozoDb.runQuery(entityQuery, params);

        if (entityResult.rows) {
            for (const row of entityResult.rows) {
                nodes.push({
                    id: row[0] as string,
                    label: row[1] as string,
                    type: 'entity',
                    entityKind: row[3] as EntityKind,
                    entitySubtype: row[4] as string | undefined,
                    metadata: {
                        normalized: row[2],
                        firstNote: row[5],
                        createdAt: row[6],
                    },
                });
            }
        }

        // Query relationships
        const nodeIds = new Set(nodes.map(n => n.id));

        let edgeQuery = `?[id, source_id, target_id, type, confidence, bidirectional] := 
            *relationships{id, source_id, target_id, type, confidence, bidirectional}`;

        if (filter.minConfidence) {
            edgeQuery += `, confidence >= $min_confidence`;
            params.min_confidence = filter.minConfidence;
        }

        const edgeResult = cozoDb.runQuery(edgeQuery, params);

        if (edgeResult.rows) {
            for (const row of edgeResult.rows) {
                const sourceId = row[1] as string;
                const targetId = row[2] as string;

                // Only include edges where both nodes are in our set
                if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
                    edges.push({
                        id: row[0] as string,
                        sourceId,
                        targetId,
                        edgeType: row[3] as string,
                        confidence: row[4] as number,
                        source: 'entity',
                        metadata: {
                            bidirectional: row[5],
                        },
                    });
                }
            }
        }

    } catch (err) {
        console.error('[DataProviders] Entity graph error:', err);
    }

    return {
        nodes,
        edges,
        source: 'entity',
        stats: {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            queryTimeMs: performance.now() - startTime,
        },
    };
}

// ===== SCOPE 3: CO-OCCURRENCE GRAPH =====

/**
 * Get co-occurrence graph data (Infranodus-style concept mesh)
 */
export async function getCooccurrenceGraphData(filter: GraphFilter): Promise<RawGraphData> {
    const startTime = performance.now();
    const nodes: RawNode[] = [];
    const edges: RawEdge[] = [];

    try {
        // Determine group_id based on scope
        let groupId = 'vault:global';
        if (filter.scope === 'folder' && filter.scopeIds?.[0]) {
            groupId = `folder:${filter.scopeIds[0]}`;
        } else if (filter.scope === 'note' && filter.scopeIds?.[0]) {
            groupId = `note:${filter.scopeIds[0]}`;
        }

        // Query co-occurrence edges
        const edgeQuery = `
            ?[id, source_id, target_id, weight, pmi_score, note_ids] :=
                *entity_edge{id, source_id, target_id, group_id, edge_type, weight, pmi_score, note_ids},
                group_id == $group_id,
                edge_type == "CO_OCCURS"
                ${filter.minConfidence ? `, weight >= $min_weight` : ''}
            :order -weight
            ${filter.limit ? `:limit ${filter.limit}` : ''}
        `;

        const params: Record<string, any> = { group_id: groupId };
        if (filter.minConfidence) {
            params.min_weight = filter.minConfidence;
        }

        const edgeResult = cozoDb.runQuery(edgeQuery, params);

        // Collect unique entity IDs from edges
        const entityIds = new Set<string>();

        if (edgeResult.rows) {
            for (const row of edgeResult.rows) {
                entityIds.add(row[1] as string);
                entityIds.add(row[2] as string);

                edges.push({
                    id: row[0] as string,
                    sourceId: row[1] as string,
                    targetId: row[2] as string,
                    edgeType: 'CO_OCCURS',
                    weight: row[3] as number,
                    confidence: 1,
                    source: 'cooccurrence',
                    metadata: {
                        pmiScore: row[4],
                        noteIds: row[5],
                    },
                });
            }
        }

        // Fetch entity details for nodes
        if (entityIds.size > 0) {
            const entityQuery = `?[id, label, kind, subtype] := 
                *entities{id, label, kind, subtype}`;

            const entityResult = cozoDb.runQuery(entityQuery, {});

            if (entityResult.rows) {
                for (const row of entityResult.rows) {
                    const id = row[0] as string;
                    if (entityIds.has(id)) {
                        nodes.push({
                            id,
                            label: row[1] as string,
                            type: 'entity',
                            entityKind: row[2] as EntityKind,
                            entitySubtype: row[3] as string | undefined,
                        });
                    }
                }
            }
        }

    } catch (err) {
        console.error('[DataProviders] Cooccurrence graph error:', err);
    }

    return {
        nodes,
        edges,
        source: 'cooccurrence',
        stats: {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            queryTimeMs: performance.now() - startTime,
        },
    };
}

// ===== UNIFIED GRAPH (All Sources Merged) =====

/**
 * Get unified graph data from all sources
 * Uses CozoDB's UNIFIED_EDGE_QUERIES to merge entity_edge + folder_hierarchy + network_relationship
 */
export async function getUnifiedGraphData(filter: GraphFilter): Promise<RawGraphData> {
    const startTime = performance.now();
    const nodes: RawNode[] = [];
    const edges: RawEdge[] = [];
    const nodeIds = new Set<string>();

    try {
        // Query unified edges based on scope
        let query: string;
        const params: Record<string, any> = {};

        if (filter.scope === 'folder' && filter.scopeIds?.[0]) {
            query = UNIFIED_EDGE_QUERIES.getEdgesByGroupId;
            params.group_id = filter.scopeIds[0];
        } else {
            query = UNIFIED_EDGE_QUERIES.getAllEdges;
        }

        const edgeResult = cozoDb.runQuery(query, params);

        if (edgeResult.rows) {
            for (const row of edgeResult.rows) {
                const sourceId = row[1] as string;
                const targetId = row[2] as string;
                const edgeSource = row[7] as string;

                nodeIds.add(sourceId);
                nodeIds.add(targetId);

                edges.push({
                    id: row[0] as string,
                    sourceId,
                    targetId,
                    edgeType: row[3] as string,
                    confidence: row[4] as number,
                    source: edgeSource === 'entity_edge' ? 'entity' :
                        edgeSource === 'folder_hierarchy' ? 'folder' : 'network',
                    metadata: {
                        sources: row[5],
                        groupId: row[6],
                    },
                });
            }
        }

        // Fetch node details for all unique IDs
        // First try entities
        const entityQuery = `?[id, label, kind, subtype] := *entities{id, label, kind, subtype}`;
        const entityResult = cozoDb.runQuery(entityQuery, {});

        const foundIds = new Set<string>();
        if (entityResult.rows) {
            for (const row of entityResult.rows) {
                const id = row[0] as string;
                if (nodeIds.has(id)) {
                    foundIds.add(id);
                    nodes.push({
                        id,
                        label: row[1] as string,
                        type: 'entity',
                        entityKind: row[2] as EntityKind,
                        entitySubtype: row[3] as string | undefined,
                    });
                }
            }
        }

        // For remaining IDs, try SQLite (notes/folders)
        const missingIds = [...nodeIds].filter(id => !foundIds.has(id));
        if (missingIds.length > 0) {
            const allNodes = await dbClient.getAllNodes();
            for (const node of allNodes) {
                if (missingIds.includes(node.id)) {
                    nodes.push({
                        id: node.id,
                        label: node.label || 'Untitled',
                        type: node.type === 'FOLDER' ? 'folder' : 'note',
                        entityKind: node.entity_kind as EntityKind | undefined,
                        parentId: node.parent_id,
                    });
                }
            }
        }

    } catch (err) {
        console.error('[DataProviders] Unified graph error:', err);
    }

    return {
        nodes,
        edges,
        source: 'unified',
        stats: {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            queryTimeMs: performance.now() - startTime,
        },
    };
}

// ===== NETWORK GRAPH =====

/**
 * Get network-specific graph (members + relationships)
 */
export async function getNetworkGraphData(
    networkId: string,
    filter?: Partial<GraphFilter>
): Promise<RawGraphData> {
    const startTime = performance.now();
    const nodes: RawNode[] = [];
    const edges: RawEdge[] = [];

    try {
        // Get network members
        const memberQuery = `
            ?[entity_id, role, joined_at] :=
                *network_membership{network_id, entity_id, role, joined_at},
                network_id == $network_id
        `;

        const memberResult = cozoDb.runQuery(memberQuery, { network_id: networkId });
        const entityIds = new Set<string>();

        if (memberResult.rows) {
            for (const row of memberResult.rows) {
                entityIds.add(row[0] as string);
            }
        }

        // Get entity details
        if (entityIds.size > 0) {
            const entityQuery = `?[id, label, kind, subtype] := *entities{id, label, kind, subtype}`;
            const entityResult = cozoDb.runQuery(entityQuery, {});

            if (entityResult.rows) {
                for (const row of entityResult.rows) {
                    const id = row[0] as string;
                    if (entityIds.has(id)) {
                        nodes.push({
                            id,
                            label: row[1] as string,
                            type: 'entity',
                            entityKind: row[2] as EntityKind,
                            entitySubtype: row[3] as string | undefined,
                        });
                    }
                }
            }
        }

        // Get network relationships
        const relQuery = `
            ?[id, source_id, target_id, relationship_code, confidence] :=
                *network_relationship{id, network_id, source_id, target_id, relationship_code, confidence},
                network_id == $network_id
        `;

        const relResult = cozoDb.runQuery(relQuery, { network_id: networkId });

        if (relResult.rows) {
            for (const row of relResult.rows) {
                edges.push({
                    id: row[0] as string,
                    sourceId: row[1] as string,
                    targetId: row[2] as string,
                    edgeType: row[3] as string,
                    confidence: row[4] as number,
                    source: 'network',
                });
            }
        }

    } catch (err) {
        console.error('[DataProviders] Network graph error:', err);
    }

    return {
        nodes,
        edges,
        source: 'entity',
        stats: {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            queryTimeMs: performance.now() - startTime,
        },
    };
}
