import { dbClient } from '@/lib/db/client/db-client';

interface RunResult {
    changes?: number;
}

export class RelationshipDBAdapter {
    async run(sql: string, params?: unknown[]): Promise<RunResult> {
        const result = await dbClient.query<{ changes: number }>(
            sql,
            params
        );
        return { changes: Array.isArray(result) ? result.length : 0 };
    }

    async get(sql: string, params?: unknown[]): Promise<unknown> {
        const rows = await dbClient.query(sql, params);
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    }

    async all(sql: string, params?: unknown[]): Promise<unknown[]> {
        const rows = await dbClient.query(sql, params);
        return Array.isArray(rows) ? rows : [];
    }
}

export const relationshipDBAdapter = new RelationshipDBAdapter();
