import { describe, it, expect, beforeEach } from 'vitest';
import { ConceptExtractor, getConceptExtractor } from '../../entities/nlp/ConceptExtractor';
import { UnifiedGraph } from '../UnifiedGraph';
import { ConceptGraphBuilder, getConceptGraphBuilder } from '../ConceptGraphBuilder';
import { entityRegistry } from '../../entities/entity-registry';

describe('Concept Extraction System (Phase 5)', () => {
    let extractor: ConceptExtractor;
    let graph: UnifiedGraph;
    let builder: ConceptGraphBuilder;

    beforeEach(() => {
        // Clear registry to avoid interference
        (entityRegistry as any)['entities'].clear();
        (entityRegistry as any)['labelIndex'].clear();
        (entityRegistry as any)['aliasIndex'].clear();

        extractor = getConceptExtractor();
        extractor.clearCache();

        graph = new UnifiedGraph();
        builder = getConceptGraphBuilder(graph);
        builder.clearCache();
    });

    describe('ConceptExtractor', () => {
        it('should extract common noun phrases as concepts', () => {
            const text = 'The ancient magic was hidden in the dark tower. Necromancy is a dangerous craft.';
            const concepts = extractor.extractConcepts(text);

            expect(concepts.length).toBeGreaterThan(0);

            const labels = concepts.map(c => c.label);
            expect(labels).toContain('ancient magic');
            expect(labels).toContain('dark tower');
            expect(labels).toContain('necromancy');
            expect(labels).toContain('dangerous craft');
        });

        it('should filter out registered entities', () => {
            // Register "Sauron" as an entity
            entityRegistry.registerEntity('Sauron', 'CHARACTER', 'note-1');

            const text = 'Sauron used his dark magic to conquer the realm.';
            const concepts = extractor.extractConcepts(text);

            const labels = concepts.map(c => c.label);
            expect(labels).not.toContain('sauron'); // Should be excluded because it's in registry
            expect(labels).toContain('dark magic');
        });

        it('should extract relations between concepts', () => {
            const text = 'In the dark tower, ancient magic flows through the stones.';
            const concepts = extractor.extractConcepts(text);
            const relations = extractor.extractConceptRelations(concepts, text, 'note-1');

            expect(relations.length).toBeGreaterThan(0);
            const r = relations[0];

            // The engine might capture "ancient magic flows" as one chunk depending on POS tagging
            const validConcepts = ['dark tower', 'ancient magic', 'ancient magic flows', 'stones'];
            expect(validConcepts).toContain(r.concept1);
            expect(validConcepts).toContain(r.concept2);
            expect(r.frequency).toBeGreaterThan(0);
        });
    });

    describe('ConceptGraphBuilder', () => {
        it('should sync concepts and relations to the graph', () => {
            const text = 'Alchemy requires deep knowledge and rare materials.';
            const concepts = extractor.extractConcepts(text);
            const relations = extractor.extractConceptRelations(concepts, text, 'note-1');

            const result = builder.syncConceptsToGraph(concepts, relations, 'note-1');

            expect(result.stats.entitiesSynced).toBeGreaterThan(0);

            // Verify graph content
            const alchemyNode = graph.findEntityByLabel('alchemy', 'CONCEPT');
            expect(alchemyNode).not.toBeNull();
            expect(alchemyNode?.data.entityKind).toBe('CONCEPT');

            const knowledgeNode = graph.findEntityByLabel('deep knowledge', 'CONCEPT');
            expect(knowledgeNode).not.toBeNull();

            // Verify relationship
            const edges = graph.getEdgesBetween(alchemyNode!.data.id, knowledgeNode!.data.id);
            expect(edges.length).toBeGreaterThan(0);
            expect(edges[0].data.type).toBe('CO_OCCURS');
        });

        it('should link concepts to explicit entities', () => {
            // Register 'Mage' as a character
            const mageNode = graph.createEntity('Gandalf the Mage', 'CHARACTER');

            // Sync concept 'Mage'
            const concepts = [{
                label: 'mage',
                originalText: 'mage',
                frequency: 1,
                firstPosition: 0,
                isCompound: false,
                mentions: []
            }];

            builder.syncConceptsToGraph(concepts as any, [], 'note-1');

            // Link
            builder.linkConceptsToEntities('note-1');

            const conceptNode = graph.findEntityByLabel('mage', 'CONCEPT')!;
            const edges = graph.getEdgesBetween(conceptNode.data.id, mageNode.data.id);

            expect(edges.length).toBeGreaterThan(0);
            expect(edges[0].data.properties?.type).toBe('CONCEPT_LINK');
        });
    });
});
