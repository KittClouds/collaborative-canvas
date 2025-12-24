/**
 * GraphBridge - Phase 4: EntityRegistry ↔ UnifiedGraph Synchronization
 * 
 * Bridges the gap between:
 * - EntityRegistry (in-memory entity storage with relationships)
 * - UnifiedGraph (Cytoscape-based visualization and query engine)
 * 
 * Key Features:
 * - Syncs entities from registry to graph nodes
 * - Converts extracted relationships to graph edges
 * - Handles co-occurrences
 * - Batch operations for performance
 * - Event-driven cache invalidation
 */

import { UnifiedGraph } from './UnifiedGraph';
import type {
    NodeId,
    EdgeType,
    UnifiedNode,
    UnifiedEdge,
    ExtractionData,
    EntityMention
} from './types';
import { entityRegistry, type RegisteredEntity } from '../entities/entity-registry';
import type { ExtractedRelationship as PatternExtractedRelationship } from '../relationships/RelationshipExtractor';
import { EntityKind } from '../entities/entityTypes';

// ==================== TYPE DEFINITIONS ====================

export interface GraphSyncResult {
    createdNodes: NodeId[];
    updatedNodes: NodeId[];
    createdEdges: string[];
    updatedEdges: string[];
    errors: Array<{ entity?: string; relationship?: string; error: string }>;
    stats: {
        entitiesSynced: number;
        relationshipsSynced: number;
        coOccurrencesSynced: number;
        duration: number;
    };
}

export interface EntitySyncOptions {
    /** Skip entities with totalMentions below this threshold */
    minMentions?: number;
    /** Only sync entities from these notes */
    noteIds?: string[];
    /** Only sync entities of these kinds */
    entityKinds?: EntityKind[];
    /** Create missing nodes for relationship endpoints */
    createMissingNodes?: boolean;
}

// ==================== GRAPH BRIDGE ====================

export class GraphBridge {
    private graph: UnifiedGraph;
    private entityNodeCache = new Map<string, NodeId>(); // label:kind -> nodeId
    private initialized = false;

    constructor(graph: UnifiedGraph) {
        this.graph = graph;
        this.initialized = true;
    }

    /**
     * Clear the entity node cache
     */
    clearCache(): void {
        this.entityNodeCache.clear();
    }

    /**
     * Make a cache key from entity label and kind
     */
    private makeCacheKey(label: string, kind: EntityKind): string {
        return `${label.toLowerCase()}::${kind}`;
    }

    /**
     * Find or create a node for an entity
     */
    findOrCreateEntityNode(
        label: string,
        kind: EntityKind,
        sourceNoteId?: NodeId,
        options?: {
            subtype?: string;
            extraction?: ExtractionData;
        }
    ): NodeId | null {
        const cacheKey = this.makeCacheKey(label, kind);

        // Check cache first
        if (this.entityNodeCache.has(cacheKey)) {
            return this.entityNodeCache.get(cacheKey)!;
        }

        // Check if node exists in graph
        const existing = this.graph.findEntityByLabel(label, kind);
        if (existing) {
            this.entityNodeCache.set(cacheKey, existing.data.id);
            return existing.data.id;
        }

        // Create new node
        try {
            const node = this.graph.createEntity(label, kind, {
                sourceNoteId,
                entitySubtype: options?.subtype,
                extraction: options?.extraction,
            });

            this.entityNodeCache.set(cacheKey, node.data.id);
            return node.data.id;
        } catch (error) {
            console.error('[GraphBridge] Failed to create entity node:', { label, kind, error });
            return null;
        }
    }

    /**
     * Sync all entities from EntityRegistry to UnifiedGraph
     */
    syncEntitiesToGraph(options: EntitySyncOptions = {}): GraphSyncResult {
        const startTime = performance.now();
        const result: GraphSyncResult = {
            createdNodes: [],
            updatedNodes: [],
            createdEdges: [],
            updatedEdges: [],
            errors: [],
            stats: {
                entitiesSynced: 0,
                relationshipsSynced: 0,
                coOccurrencesSynced: 0,
                duration: 0,
            },
        };

        const entities = entityRegistry.getAllEntities();

        // Filter entities based on options
        const filteredEntities = entities.filter(entity => {
            if (options.minMentions && entity.totalMentions < options.minMentions) {
                return false;
            }
            if (options.entityKinds && !options.entityKinds.includes(entity.kind)) {
                return false;
            }
            if (options.noteIds) {
                const hasNote = options.noteIds.some(noteId =>
                    entity.noteAppearances.has(noteId)
                );
                if (!hasNote) return false;
            }
            return true;
        });

        // Use batch mode for performance
        this.graph.getInstance().batch(() => {
            for (const entity of filteredEntities) {
                try {
                    // Build extraction data
                    const extraction: ExtractionData = {
                        method: 'regex', // Could be extended based on entity.discoverySource
                        confidence: 1.0, // Registered entities have high confidence
                        mentions: this.buildMentionsFromEntity(entity),
                        frequency: entity.totalMentions,
                    };

                    const existingNode = this.graph.findEntityByLabel(entity.label, entity.kind);

                    if (existingNode) {
                        // Update existing node
                        this.graph.updateNode(existingNode.data.id, {
                            extraction,
                            updatedAt: Date.now(),
                        });
                        result.updatedNodes.push(existingNode.data.id);
                        this.entityNodeCache.set(
                            this.makeCacheKey(entity.label, entity.kind),
                            existingNode.data.id
                        );
                    } else {
                        // Create new node
                        const nodeId = this.findOrCreateEntityNode(
                            entity.label,
                            entity.kind,
                            entity.canonicalNoteId,
                            {
                                subtype: entity.subtype,
                                extraction,
                            }
                        );

                        if (nodeId) {
                            result.createdNodes.push(nodeId);
                        }
                    }

                    result.stats.entitiesSynced++;
                } catch (error) {
                    result.errors.push({
                        entity: entity.label,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        });

        result.stats.duration = performance.now() - startTime;
        return result;
    }

    /**
     * Build EntityMention array from RegisteredEntity
     */
    private buildMentionsFromEntity(entity: RegisteredEntity): EntityMention[] {
        const mentions: EntityMention[] = [];

        for (const [noteId, count] of entity.mentionsByNote.entries()) {
            for (let i = 0; i < count; i++) {
                mentions.push({
                    noteId,
                    charPosition: 0, // We don't track exact positions in registry
                    context: '', // Could be populated from scanner results
                });
            }
        }

        return mentions;
    }

    /**
     * Sync extracted relationships to graph edges
     */
    syncRelationshipsToGraph(
        relationships: PatternExtractedRelationship[],
        noteId: NodeId,
        options: EntitySyncOptions = {}
    ): GraphSyncResult {
        const startTime = performance.now();
        const result: GraphSyncResult = {
            createdNodes: [],
            updatedNodes: [],
            createdEdges: [],
            updatedEdges: [],
            errors: [],
            stats: {
                entitiesSynced: 0,
                relationshipsSynced: 0,
                coOccurrencesSynced: 0,
                duration: 0,
            },
        };

        this.graph.getInstance().batch(() => {
            for (const rel of relationships) {
                try {
                    // Find or create source node
                    const sourceNodeId = this.findOrCreateEntityNode(
                        rel.source.entity.label,
                        rel.source.entity.kind,
                        noteId
                    );

                    // Find or create target node
                    const targetNodeId = this.findOrCreateEntityNode(
                        rel.target.entity.label,
                        rel.target.entity.kind,
                        noteId
                    );

                    if (!sourceNodeId || !targetNodeId) {
                        if (!options.createMissingNodes) {
                            result.errors.push({
                                relationship: `${rel.source.text} -> ${rel.target.text}`,
                                error: 'Source or target node not found and createMissingNodes is false',
                            });
                            continue;
                        }
                    }

                    // Map predicate to EdgeType
                    const edgeType = this.mapPredicateToEdgeType(rel.predicate);

                    // Check for existing edge
                    const existingEdges = this.graph.getEdgesBetween(sourceNodeId!, targetNodeId!);
                    const existingEdge = existingEdges.find(e => e.data.type === edgeType);

                    if (existingEdge) {
                        // Update existing edge
                        const currentWeight = existingEdge.data.weight || 0;
                        const currentNoteIds = existingEdge.data.noteIds || [];

                        this.graph.updateEdge(existingEdge.data.id, {
                            weight: currentWeight + 1,
                            noteIds: [...new Set([...currentNoteIds, noteId])],
                            confidence: Math.max(existingEdge.data.confidence || 0, rel.confidence),
                        });
                        result.updatedEdges.push(existingEdge.data.id);
                    } else {
                        // Create new edge
                        const edge = this.graph.createRelationship(
                            sourceNodeId!,
                            targetNodeId!,
                            edgeType,
                            {
                                predicate: rel.predicate,
                                pattern: rel.pattern,
                                confidence: rel.confidence,
                                sentence: rel.context.sentence,
                                sentenceIndex: rel.context.sentenceIndex,
                                verbLemma: rel.context.verbLemma,
                                preposition: rel.context.preposition,
                                extractedAt: rel.metadata.extractedAt,
                                sourceNoteId: noteId,
                            }
                        );
                        result.createdEdges.push(edge.data.id);
                    }

                    result.stats.relationshipsSynced++;
                } catch (error) {
                    result.errors.push({
                        relationship: `${rel.source.text} -> ${rel.target.text}`,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        });

        result.stats.duration = performance.now() - startTime;
        return result;
    }

    /**
     * Map predicate strings to EdgeType
     */
    private mapPredicateToEdgeType(predicate: string): EdgeType {
        const mapping: Record<string, EdgeType> = {
            // Common predicates
            'owns': 'OWNS',
            'possesses': 'OWNS',
            'located_in': 'LOCATED_IN',
            'member_of': 'MEMBER_OF',
            'knows': 'KNOWS',
            'related_to': 'RELATED_TO',
            'with': 'RELATED_TO',

            // Causal
            'leads': 'LEADS_TO',
            'causes': 'CAUSED_BY',
            'enables': 'ENABLES',
            'prevents': 'PREVENTS',

            // Temporal
            'before': 'BEFORE',
            'after': 'AFTER',
            'during': 'DURING',

            // Narrative
            'foreshadows': 'FORESHADOWS',
            'parallels': 'PARALLELS',
            'contrasts': 'CONTRASTS',
        };

        // Check direct mapping
        const lowered = predicate.toLowerCase();
        if (mapping[lowered]) {
            return mapping[lowered];
        }

        // Check partial matches
        for (const [key, type] of Object.entries(mapping)) {
            if (lowered.includes(key)) {
                return type;
            }
        }

        // Default to RELATED_TO for unknown predicates
        return predicate as EdgeType;
    }

    /**
     * Sync co-occurrences to graph edges
     */
    syncCoOccurrencesToGraph(
        coOccurrences: Array<{
            entity1Label: string;
            entity1Kind: EntityKind;
            entity2Label: string;
            entity2Kind: EntityKind;
            frequency: number;
            noteIds: string[];
        }>
    ): GraphSyncResult {
        const startTime = performance.now();
        const result: GraphSyncResult = {
            createdNodes: [],
            updatedNodes: [],
            createdEdges: [],
            updatedEdges: [],
            errors: [],
            stats: {
                entitiesSynced: 0,
                relationshipsSynced: 0,
                coOccurrencesSynced: 0,
                duration: 0,
            },
        };

        this.graph.getInstance().batch(() => {
            for (const coOcc of coOccurrences) {
                try {
                    const nodeAId = this.findOrCreateEntityNode(
                        coOcc.entity1Label,
                        coOcc.entity1Kind
                    );
                    const nodeBId = this.findOrCreateEntityNode(
                        coOcc.entity2Label,
                        coOcc.entity2Kind
                    );

                    if (!nodeAId || !nodeBId) {
                        result.errors.push({
                            relationship: `${coOcc.entity1Label} <-> ${coOcc.entity2Label}`,
                            error: 'Could not find or create entity nodes',
                        });
                        continue;
                    }

                    // Use built-in co-occurrence method which handles deduplication
                    const edge = this.graph.createCoOccurrence(
                        nodeAId,
                        nodeBId,
                        coOcc.frequency,
                        coOcc.noteIds
                    );

                    // Check if it was an update or create based on whether edge exists
                    const existingEdges = this.graph.getEdgesBetween(nodeAId, nodeBId);
                    if (existingEdges.length > 1) {
                        result.updatedEdges.push(edge.data.id);
                    } else {
                        result.createdEdges.push(edge.data.id);
                    }

                    result.stats.coOccurrencesSynced++;
                } catch (error) {
                    result.errors.push({
                        relationship: `${coOcc.entity1Label} <-> ${coOcc.entity2Label}`,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        });

        result.stats.duration = performance.now() - startTime;
        return result;
    }

    /**
     * Full sync: entities + relationships + co-occurrences
     */
    fullSync(
        relationships: PatternExtractedRelationship[],
        coOccurrences: Array<{
            entity1Label: string;
            entity1Kind: EntityKind;
            entity2Label: string;
            entity2Kind: EntityKind;
            frequency: number;
            noteIds: string[];
        }>,
        noteId: NodeId,
        options: EntitySyncOptions = {}
    ): GraphSyncResult {
        const startTime = performance.now();

        // Sync entities first
        const entityResult = this.syncEntitiesToGraph(options);

        // Then relationships
        const relResult = this.syncRelationshipsToGraph(relationships, noteId, options);

        // Then co-occurrences
        const coOccResult = this.syncCoOccurrencesToGraph(coOccurrences);

        // Merge results
        return {
            createdNodes: [...entityResult.createdNodes, ...relResult.createdNodes, ...coOccResult.createdNodes],
            updatedNodes: [...entityResult.updatedNodes, ...relResult.updatedNodes, ...coOccResult.updatedNodes],
            createdEdges: [...entityResult.createdEdges, ...relResult.createdEdges, ...coOccResult.createdEdges],
            updatedEdges: [...entityResult.updatedEdges, ...relResult.updatedEdges, ...coOccResult.updatedEdges],
            errors: [...entityResult.errors, ...relResult.errors, ...coOccResult.errors],
            stats: {
                entitiesSynced: entityResult.stats.entitiesSynced,
                relationshipsSynced: relResult.stats.relationshipsSynced,
                coOccurrencesSynced: coOccResult.stats.coOccurrencesSynced,
                duration: performance.now() - startTime,
            },
        };
    }

    /**
     * Destroy the bridge and clean up
     */
    destroy(): void {
        this.clearCache();
        this.initialized = false;
    }
}

// ==================== SINGLETON MANAGEMENT ====================

let bridgeInstance: GraphBridge | null = null;
let currentGraphRef: WeakRef<UnifiedGraph> | null = null;

export function getGraphBridge(graph: UnifiedGraph): GraphBridge {
    // Check if existing bridge is for the same graph
    if (bridgeInstance && currentGraphRef?.deref() === graph) {
        return bridgeInstance;
    }

    // Destroy old bridge if graph changed
    if (bridgeInstance) {
        bridgeInstance.destroy();
    }

    // Create new bridge
    bridgeInstance = new GraphBridge(graph);
    currentGraphRef = new WeakRef(graph);

    return bridgeInstance;
}

export function clearGraphBridge(): void {
    if (bridgeInstance) {
        bridgeInstance.destroy();
        bridgeInstance = null;
        currentGraphRef = null;
    }
}
