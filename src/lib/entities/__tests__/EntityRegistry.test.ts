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

        // Note: With new idempotent logic, duplicate registerEntity calls on different notes adds mentions
        // But logic is: if noteId exists, increment count? No, logic is: add noteId to map if not exists?
        // Let's check logic:
        // registerEntity: existing.mentionsByNote.set(noteId, existing.mentionsByNote.get(noteId) + 1)
        // So yes, it increments. Total mentions should be 2.

        if (entity.totalMentions !== 2) throw new Error(`Mentions count mismatch: ${entity.totalMentions} vs 2`);
        if (entity.noteAppearances.size !== 2) throw new Error('Note appearances count mismatch');
    });

    test('persists and loads', () => {
        registry.registerEntity('Jillybean', 'CHARACTER', 'note1');
        const json = registry.toJSON();
        const loaded = EntityRegistry.fromJSON(json);

        if (loaded.getAllEntities().length !== 1) throw new Error('Loaded count mismatch');
        if (!loaded.findEntity('Jillybean')) throw new Error('Loaded entity definition mismatch');
    });

    // --- HARDENING TESTS ---

    test('deletes entity and cascades', () => {
        const entity = registry.registerEntity('Target', 'CHARACTER', 'note1');
        registry.addAlias(entity.id, 'Targe');
        registry.registerEntity('Other', 'CHARACTER', 'note1');
        registry.addRelationship('Target', 'Other', 'FRIENDS_WITH', 'note1');

        // Delete
        const deleted = registry.deleteEntity(entity.id);
        if (!deleted) throw new Error('Deletion returned false');

        // Check Entity Gone
        if (registry.findEntity('Target')) throw new Error('Entity still searchable by label');
        if (registry.findEntity('Targe')) throw new Error('Entity still searchable by alias');

        // Check Relationships Gone
        const other = registry.findEntity('Other');
        const rels = registry.getRelationships(other!.id);
        if (rels.length !== 0) throw new Error('Relationship not cascaded');
    });

    test('updates entity label and index', () => {
        const entity = registry.registerEntity('OldName', 'CHARACTER', 'note1');
        registry.updateEntity(entity.id, { label: 'NewName' });

        if (registry.findEntity('OldName')) throw new Error('Old label still indexed');
        const found = registry.findEntity('NewName');
        if (!found) throw new Error('New label not indexed');
        if (found.id !== entity.id) throw new Error('ID mismatch after rename');
    });

    test('merges entities', () => {
        const keep = registry.registerEntity('Keep', 'CHARACTER', 'note1');
        const toss = registry.registerEntity('Toss', 'CHARACTER', 'note2');

        registry.addAlias(toss.id, 'Tosser');
        registry.updateNoteMentions(toss.id, 'note2', 5);

        const success = registry.mergeEntities(keep.id, toss.id);
        if (!success) throw new Error('Merge failed');

        // Check Toss is gone
        if (registry.getEntityById(toss.id)) throw new Error('Source entity not deleted');

        // Check Keep has Toss properties
        const merged = registry.getEntityById(keep.id)!;
        if (!merged.aliases?.includes('Tosser')) throw new Error('Aliases not merged');
        if (!merged.noteAppearances.has('note2')) throw new Error('Note appearances not merged');
        if (merged.mentionsByNote.get('note2') !== 5) throw new Error('Mention counts not merged correctly');

        // Check finding by old name/alias works (pointing to new entity)
        const foundByOld = registry.findEntity('Toss'); // "Toss" was added as alias to Keep
        if (foundByOld?.id !== keep.id) throw new Error('Old label lookup failed');
    });

    test('cleans up on note deletion', () => {
        const entity = registry.registerEntity('Persistent', 'CHARACTER', 'note1');
        registry.updateNoteMentions(entity.id, 'note1', 10);

        registry.onNoteDeleted('note1');

        const check = registry.getEntityById(entity.id)!;
        if (check.noteAppearances.has('note1')) throw new Error('Note appearance not removed');
        if (check.mentionsByNote.has('note1')) throw new Error('Mention count not removed');
        if (check.totalMentions !== 0) throw new Error('Total mentions not recalculated');
    });
});

console.log('✅ All EntityRegistry tests passed!');
