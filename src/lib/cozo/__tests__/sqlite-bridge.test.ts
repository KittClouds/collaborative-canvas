/**
 * CozoDB SQLite Bridge Integration Tests
 * 
 * Tests the bidirectional sync between CozoDB and SQLite persistence.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { dbClient } from '@/lib/db';
import { cozoDb } from '@/lib/cozo/db';

describe('CozoDB SQLite Bridge', () => {
    beforeAll(async () => {
        // Note: In a real test environment, we'd use a test database
        // For now, these tests document expected behavior
    });

    afterAll(async () => {
        // Cleanup would go here
    });

    describe('SQLite Persistence Layer', () => {
        it('should have cozo tables after init', async () => {
            await dbClient.init();
            const tables = await dbClient.cozoGetTables();

            expect(tables).toContain('cozo_entities');
            expect(tables).toContain('cozo_relationships');
        });

        it('should bulk insert and retrieve rows', async () => {
            await dbClient.init();

            const testRows = [
                ['test_entity_1', 'Test Entity', 'test entity', 'CHARACTER', null, 'note_1', Date.now(), 'test'],
            ];

            await dbClient.cozoBulkInsert(
                'cozo_entities',
                ['id', 'label', 'normalized', 'kind', 'subtype', 'first_note', 'created_at', 'created_by'],
                testRows
            );

            const result = await dbClient.cozoGetTableData('cozo_entities');

            expect(result.columns).toContain('id');
            expect(result.columns).toContain('label');
            expect(result.rows.some(r => r[0] === 'test_entity_1')).toBe(true);
        });

        it('should clear table', async () => {
            await dbClient.init();
            await dbClient.cozoClearTable('cozo_entities');

            const result = await dbClient.cozoGetTableData('cozo_entities');
            expect(result.rows.length).toBe(0);
        });
    });

    describe('CozoDB Service', () => {
        it('should initialize without errors', async () => {
            await expect(cozoDb.init()).resolves.not.toThrow();
            expect(cozoDb.isReady()).toBe(true);
        });

        it('should run queries', async () => {
            await cozoDb.init();

            // Create a test relation
            const createResult = cozoDb.runQuery(`:create test_bridge_rel { id: String => value: String }`);
            expect(createResult.ok).toBe(true);

            // Insert data
            const insertResult = cozoDb.runQuery(`
        ?[id, value] <- [["key1", "value1"]]
        :put test_bridge_rel { id, value }
      `);
            expect(insertResult.ok).toBe(true);

            // Query data
            const queryResult = cozoDb.runQuery(`?[id, value] := *test_bridge_rel{id, value}`);
            expect(queryResult.ok).toBe(true);
            expect(queryResult.rows).toHaveLength(1);
            expect(queryResult.rows[0]).toEqual(['key1', 'value1']);

            // Cleanup
            cozoDb.runQuery(`:rm test_bridge_rel {}`);
        });

        it('should export and import relations', async () => {
            await cozoDb.init();

            // Create and populate
            cozoDb.runQuery(`:create export_test { id: String => name: String }`);
            cozoDb.runQuery(`?[id, name] <- [["1", "TestName"]] :put export_test { id, name }`);

            // Export
            const exported = cozoDb.exportRelations(['export_test']);
            expect(exported).toContain('export_test');

            // Clear and re-import
            cozoDb.runQuery(`?[id, name] := *export_test{id, name} :rm export_test {id, name}`);
            cozoDb.importRelations(exported);

            // Verify
            const result = cozoDb.runQuery(`?[id, name] := *export_test{id, name}`);
            expect(result.rows).toHaveLength(1);

            // Cleanup
            cozoDb.runQuery(`:rm export_test {}`);
        });

        it('saveSnapshot should not throw (deprecated but safe)', async () => {
            await cozoDb.init();

            // Should warn but not throw
            await expect(cozoDb.saveSnapshot(['entities'])).resolves.not.toThrow();
        });

        it('getSnapshotInfo should return persistence info', async () => {
            await cozoDb.init();

            const info = await cozoDb.getSnapshotInfo();
            expect(info).not.toBeNull();
            expect(info?.totalRelations).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Auto-persist Detection', () => {
        it('should detect :put operations', async () => {
            await cozoDb.init();

            // Create the entities relation if not exists (this is auto-detected)
            const script = `
        ?[id, label, normalized, kind, subtype, first_note, created_at, created_by] <- [[
          "auto_persist_test",
          "Auto Test",
          "auto test",
          "CHARACTER",
          null,
          "note1",
          ${Date.now()},
          "test"
        ]]
        :put entities { id, label, normalized, kind, subtype, first_note, created_at, created_by }
      `;

            // This should trigger auto-persist
            const result = cozoDb.runQuery(script);
            expect(result.ok).toBe(true);

            // Give debounce time to flush
            await new Promise(resolve => setTimeout(resolve, 1500));
        });
    });
});
