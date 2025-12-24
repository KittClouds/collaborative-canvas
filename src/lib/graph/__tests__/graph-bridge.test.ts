import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GraphBridge, getGraphBridge, clearGraphBridge } from '../GraphBridge';
import { UnifiedGraph } from '../UnifiedGraph';
import { entityRegistry } from '../../entities/entity-registry';
import type { ExtractedRelationship } from '../../relationships/RelationshipExtractor';

describe('GraphBridge', () => {
    let graph: UnifiedGraph;
    let bridge: GraphBridge;

    beforeEach(() => {
        // Clear entity registry
        (entityRegistry as any)['entities'].clear();
        (entityRegistry as any)['labelIndex'].clear();
        (entityRegistry as any)['aliasIndex'].clear();

        // Clear singleton
        clearGraphBridge();

        // Create fresh graph and bridge
        graph = new UnifiedGraph();
        bridge = getGraphBridge(graph);
    });

    describe('Entity Sync', () => {
        it('should sync registered entities to graph nodes', () => {
            // Register entities
            entityRegistry.registerEntity('Aragorn', 'CHARACTER', 'note-1');
            entityRegistry.registerEntity('Rivendell', 'LOCATION', 'note-1');

            const result = bridge.syncEntitiesToGraph();

            expect(result.stats.entitiesSynced).toBe(2);
            expect(result.createdNodes.length).toBe(2);
            expect(result.errors.length).toBe(0);

            // Verify nodes exist in graph
            const aragornNode = graph.findEntityByLabel('Aragorn', 'CHARACTER');
            expect(aragornNode).not.toBeNull();
            expect(aragornNode?.data.entityKind).toBe('CHARACTER');

            const rivendellNode = graph.findEntityByLabel('Rivendell', 'LOCATION');
            expect(rivendellNode).not.toBeNull();
        });

        it('should update existing nodes on re-sync', () => {
            entityRegistry.registerEntity('Gandalf', 'CHARACTER', 'note-1');

            // First sync
            const result1 = bridge.syncEntitiesToGraph();
            expect(result1.createdNodes.length).toBe(1);

            // Add more mentions
            entityRegistry.updateNoteMentions(
                entityRegistry.getAllEntities()[0].id,
                'note-2',
                3
            );

            // Re-sync
            const result2 = bridge.syncEntitiesToGraph();
            expect(result2.updatedNodes.length).toBe(1);
            expect(result2.createdNodes.length).toBe(0);
        });

        it('should filter entities by minMentions', () => {
            entityRegistry.registerEntity('MajorChar', 'CHARACTER', 'note-1');
            entityRegistry.registerEntity('MinorChar', 'CHARACTER', 'note-2');

            // Add more mentions to major character
            const majorId = entityRegistry.getAllEntities().find(e => e.label === 'MajorChar')!.id;
            entityRegistry.updateNoteMentions(majorId, 'note-2', 5);
            entityRegistry.updateNoteMentions(majorId, 'note-3', 3);

            const result = bridge.syncEntitiesToGraph({ minMentions: 5 });

            // Only MajorChar should be synced (9 total mentions)
            expect(result.stats.entitiesSynced).toBe(1);
        });
    });

    describe('Relationship Sync', () => {
        it('should create edges for extracted relationships', () => {
            // Pre-register entities
            entityRegistry.registerEntity('Frodo', 'CHARACTER', 'note-1');
            entityRegistry.registerEntity('Ring', 'ITEM', 'note-1');
            bridge.syncEntitiesToGraph();

            const relationships: ExtractedRelationship[] = [
                {
                    source: {
                        entity: entityRegistry.getAllEntities().find(e => e.label === 'Frodo')!,
                        text: 'Frodo',
                        position: 0,
                    },
                    target: {
                        entity: entityRegistry.getAllEntities().find(e => e.label === 'Ring')!,
                        text: 'Ring',
                        position: 10,
                    },
                    predicate: 'owns',
                    pattern: 'POSSESSION',
                    confidence: 0.85,
                    context: {
                        sentence: "Frodo's Ring was powerful.",
                        sentenceIndex: 0,
                    },
                    metadata: {
                        extractedAt: new Date(),
                        noteId: 'note-1',
                    },
                },
            ];

            const result = bridge.syncRelationshipsToGraph(relationships, 'note-1');

            expect(result.stats.relationshipsSynced).toBe(1);
            expect(result.createdEdges.length).toBe(1);

            // Verify edge exists
            const frodoNode = graph.findEntityByLabel('Frodo', 'CHARACTER')!;
            const ringNode = graph.findEntityByLabel('Ring', 'ITEM')!;
            const edges = graph.getEdgesBetween(frodoNode.data.id, ringNode.data.id);

            expect(edges.length).toBe(1);
            expect(edges[0].data.type).toBe('OWNS');
        });

        it('should update existing edges on re-sync', () => {
            entityRegistry.registerEntity('Gandalf', 'CHARACTER', 'note-1');
            entityRegistry.registerEntity('Balrog', 'CHARACTER', 'note-1');
            bridge.syncEntitiesToGraph();

            const gandalfEntity = entityRegistry.getAllEntities().find(e => e.label === 'Gandalf')!;
            const balrogEntity = entityRegistry.getAllEntities().find(e => e.label === 'Balrog')!;

            const relationships: ExtractedRelationship[] = [
                {
                    source: { entity: gandalfEntity, text: 'Gandalf', position: 0 },
                    target: { entity: balrogEntity, text: 'Balrog', position: 20 },
                    predicate: 'defeated',
                    pattern: 'SVO',
                    confidence: 0.9,
                    context: { sentence: 'Gandalf defeated the Balrog.', sentenceIndex: 0 },
                    metadata: { extractedAt: new Date(), noteId: 'note-1' },
                },
            ];

            // First sync
            bridge.syncRelationshipsToGraph(relationships, 'note-1');

            // Second sync (from different note)
            const result2 = bridge.syncRelationshipsToGraph(relationships, 'note-2');

            expect(result2.updatedEdges.length).toBe(1);
            expect(result2.createdEdges.length).toBe(0);
        });
    });

    describe('Co-Occurrence Sync', () => {
        it('should create co-occurrence edges', () => {
            entityRegistry.registerEntity('Legolas', 'CHARACTER', 'note-1');
            entityRegistry.registerEntity('Gimli', 'CHARACTER', 'note-1');
            bridge.syncEntitiesToGraph();

            const coOccurrences = [
                {
                    entity1Label: 'Legolas',
                    entity1Kind: 'CHARACTER' as const,
                    entity2Label: 'Gimli',
                    entity2Kind: 'CHARACTER' as const,
                    frequency: 5,
                    noteIds: ['note-1', 'note-2'],
                },
            ];

            const result = bridge.syncCoOccurrencesToGraph(coOccurrences);

            expect(result.stats.coOccurrencesSynced).toBe(1);
            expect(result.createdEdges.length).toBe(1);

            // Verify edge
            const legolasNode = graph.findEntityByLabel('Legolas', 'CHARACTER')!;
            const gimliNode = graph.findEntityByLabel('Gimli', 'CHARACTER')!;
            const edges = graph.getEdgesBetween(legolasNode.data.id, gimliNode.data.id);

            expect(edges.some(e => e.data.type === 'CO_OCCURS')).toBe(true);
        });
    });

    describe('Full Sync', () => {
        it('should sync entities, relationships, and co-occurrences together', () => {
            entityRegistry.registerEntity('Aragorn', 'CHARACTER', 'note-1');
            entityRegistry.registerEntity('Arwen', 'CHARACTER', 'note-1');

            const aragorn = entityRegistry.getAllEntities().find(e => e.label === 'Aragorn')!;
            const arwen = entityRegistry.getAllEntities().find(e => e.label === 'Arwen')!;

            const relationships: ExtractedRelationship[] = [
                {
                    source: { entity: aragorn, text: 'Aragorn', position: 0 },
                    target: { entity: arwen, text: 'Arwen', position: 15 },
                    predicate: 'loves',
                    pattern: 'SVO',
                    confidence: 0.8,
                    context: { sentence: 'Aragorn loved Arwen.', sentenceIndex: 0 },
                    metadata: { extractedAt: new Date(), noteId: 'note-1' },
                },
            ];

            const coOccurrences = [
                {
                    entity1Label: 'Aragorn',
                    entity1Kind: 'CHARACTER' as const,
                    entity2Label: 'Arwen',
                    entity2Kind: 'CHARACTER' as const,
                    frequency: 10,
                    noteIds: ['note-1'],
                },
            ];

            const result = bridge.fullSync(relationships, coOccurrences, 'note-1');

            expect(result.stats.entitiesSynced).toBe(2);
            expect(result.stats.relationshipsSynced).toBe(1);
            expect(result.stats.coOccurrencesSynced).toBe(1);
            expect(result.errors.length).toBe(0);
        });
    });

    describe('Singleton Management', () => {
        it('should return same instance for same graph', () => {
            const bridge1 = getGraphBridge(graph);
            const bridge2 = getGraphBridge(graph);

            expect(bridge1).toBe(bridge2);
        });

        it('should create new instance for different graph', () => {
            const bridge1 = getGraphBridge(graph);

            const newGraph = new UnifiedGraph();
            const bridge2 = getGraphBridge(newGraph);

            expect(bridge1).not.toBe(bridge2);
        });
    });
});
