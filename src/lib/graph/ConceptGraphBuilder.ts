/**
 * ConceptGraphBuilder - Phase 5 Feature: Concept Graph Construction
 * 
 * Bridges ConceptExtractor results into the UnifiedGraph.
 * Enables the "Concept Mesh" layer in the knowledge graph.
 * 
 * Features:
 * - Concept node creation
 * - Concept-to-concept relationship (CO_OCCURS)
 * - Concept-to-Entity linking (finding implicit links)
 * - Batch graph updates
 * - Result caching for performance
 */

import { UnifiedGraph } from './UnifiedGraph';
import type {
    NodeId,
    GraphSyncResult
} from './types';
import type { Concept, ConceptRelation } from '../entities/nlp/ConceptExtractor';

// ==================== CONCEPT GRAPH BUILDER ====================

export class ConceptGraphBuilder {
    private graph: UnifiedGraph;
    private conceptNodeCache = new Map<string, NodeId>();

    constructor(graph: UnifiedGraph) {
        this.graph = graph;
    }

    /**
     * Clear local concept node cache
     */
    clearCache(): void {
        this.conceptNodeCache.clear();
    }

    /**
     * Sync concepts and relations to the graph
     */
    syncConceptsToGraph(
        concepts: Concept[],
        relations: ConceptRelation[],
        noteId: string
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
                duration: 0
            }
        };

        // Use batch mode for performance
        this.graph.getInstance().batch(() => {
            // 1. Sync concept nodes
            for (const concept of concepts) {
                try {
                    const nodeId = this.findOrCreateConceptNode(concept, noteId);
                    if (this.conceptNodeCache.has(concept.label)) {
                        result.updatedNodes.push(nodeId);
                    } else {
                        result.createdNodes.push(nodeId);
                    }
                    this.conceptNodeCache.set(concept.label, nodeId);
                    result.stats.entitiesSynced++;
                } catch (error) {
                    result.errors.push({
                        entity: concept.label,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // 2. Sync relationships (as co-occurrences)
            for (const rel of relations) {
                try {
                    const nodeA = this.conceptNodeCache.get(rel.concept1);
                    const nodeB = this.conceptNodeCache.get(rel.concept2);

                    if (!nodeA || !nodeB) continue;

                    const edge = this.graph.createCoOccurrence(
                        nodeA,
                        nodeB,
                        rel.frequency,
                        [noteId]
                    );

                    result.createdEdges.push(edge.data.id);
                    result.stats.coOccurrencesSynced++;
                } catch (error) {
                    result.errors.push({
                        relationship: `${rel.concept1} <-> ${rel.concept2}`,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
        });

        result.stats.duration = performance.now() - startTime;
        return result;
    }

    /**
     * Internal helper to find or create a concept node
     */
    private findOrCreateConceptNode(concept: Concept, sourceNoteId: string): NodeId {
        // Check graph for existing node by label and kind
        const existing = this.graph.findEntityByLabel(concept.label, 'CONCEPT');
        if (existing) {
            // Update metadata/frequency
            const currentFreq = existing.data.extraction?.frequency || 0;
            this.graph.updateNode(existing.data.id, {
                extraction: {
                    method: 'ner', // concepts are derived via linguistic analysis
                    confidence: 0.7,
                    frequency: currentFreq + concept.frequency,
                    mentions: [
                        ...(existing.data.extraction?.mentions || []),
                        ...concept.mentions.map(m => ({
                            noteId: sourceNoteId,
                            charPosition: m.start,
                            sentenceIndex: m.sentenceIndex,
                            context: '' // Optional context
                        }))
                    ]
                }
            });
            return existing.data.id;
        }

        // Create new node
        const node = this.graph.createEntity(concept.label, 'CONCEPT', {
            sourceNoteId,
            extraction: {
                method: 'ner',
                confidence: 0.7,
                frequency: concept.frequency,
                mentions: concept.mentions.map(m => ({
                    noteId: sourceNoteId,
                    charPosition: m.start,
                    sentenceIndex: m.sentenceIndex,
                    context: ''
                }))
            }
        });

        return node.data.id;
    }

    /**
     * Link concepts to explicit entities in the graph
     * (Finding nodes with different kind but similar label)
     */
    linkConceptsToEntities(noteId: string): void {
        const concepts = this.graph.getEntitiesByKind('CONCEPT');
        const otherEntities = this.graph.getInstance().nodes('[type = "ENTITY"][entityKind != "CONCEPT"]');

        this.graph.getInstance().batch(() => {
            for (const conceptNode of concepts) {
                const label = conceptNode.data.label.toLowerCase();

                // Find matching entities
                otherEntities.forEach(entityNode => {
                    const entityData = entityNode.data();
                    if (entityData.label.toLowerCase().includes(label) || label.includes(entityData.label.toLowerCase())) {
                        // Create link
                        this.graph.createRelationship(
                            conceptNode.data.id,
                            entityData.id,
                            'RELATED_TO',
                            { type: 'CONCEPT_LINK', confidence: 0.6 }
                        );
                    }
                });
            }
        });
    }
}

// ==================== SINGLETON WRAPPERS ====================

let builderInstance: ConceptGraphBuilder | null = null;
let graphRef: WeakRef<UnifiedGraph> | null = null;

export function getConceptGraphBuilder(graph: UnifiedGraph): ConceptGraphBuilder {
    if (!builderInstance || graphRef?.deref() !== graph) {
        builderInstance = new ConceptGraphBuilder(graph);
        graphRef = new WeakRef(graph);
    }
    return builderInstance;
}
