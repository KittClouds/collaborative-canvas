import { describe, test, beforeEach, expect } from 'vitest';
import { EntityRegistry } from '../entity-registry';

describe('EntityRegistry', () => {
    let registry: EntityRegistry;

    beforeEach(() => {
        registry = new EntityRegistry();
    });

    test('registers new entity', () => {
        const entity = registry.registerEntity('Jillybean', 'CHARACTER', 'note1');
        if (entity.label !== 'Jillybean') throw new Error('Label mismatch');
        if (entity.kind !== 'CHARACTER') throw new Error('Kind mismatch');
    });

    test('finds entity by label', () => {
        registry.registerEntity('Jillybean', 'CHARACTER', 'note1');
        const found = registry.findEntity('jillybean'); // case-insensitive
        if (!found) throw new Error('Entity not found');
        if (found.label !== 'Jillybean') throw new Error('Label mismatch');
    });

    test('adds and finds aliases', () => {
        const entity = registry.registerEntity('Jillybean', 'CHARACTER', 'note1');
        registry.addAlias(entity.id, 'Jilly');

        const found = registry.findEntity('Jilly');
        if (!found) throw new Error('Alias not found');
        if (found.id !== entity.id) throw new Error('Alias ID mismatch');
    });

    test('tracks mentions across notes', () => {
        const entity = registry.registerEntity('Jillybean', 'CHARACTER', 'note1');
        registry.registerEntity('Jillybean', 'CHARACTER', 'note2'); // mention in another note

        if (entity.totalMentions !== 2) throw new Error('Mentions count mismatch');
        if (entity.noteAppearances.size !== 2) throw new Error('Note appearances count mismatch');
    });

    test('persists and loads', () => {
        registry.registerEntity('Jillybean', 'CHARACTER', 'note1');
        const json = registry.toJSON();
        const loaded = EntityRegistry.fromJSON(json);

        if (loaded.getAllEntities().length !== 1) throw new Error('Loaded count mismatch');
        if (!loaded.findEntity('Jillybean')) throw new Error('Loaded entity definition mismatch');
    });
});

console.log('✅ All EntityRegistry tests passed!');
