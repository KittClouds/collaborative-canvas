import { dbClient } from '../client/db-client';
import type { FTSSearchResult, FTSSearchOptions } from '../client/types';

/**
 * FTS5 full-text search wrapper
 */
export class FTSSearch {
    /**
     * Search using FTS5 (fallback when ResoRank unavailable)
     */
    async search(
        query: string,
        options: Partial<FTSSearchOptions> = {}
    ): Promise<FTSSearchResult[]> {
        const searchOptions: FTSSearchOptions = {
            query,
            limit: options.limit ?? 20,
            type: options.type,
            entity_kind: options.entity_kind,
        };

        return dbClient.ftsSearch(searchOptions);
    }

    /**
     * Check if FTS5 is available and working
     */
    async isAvailable(): Promise<boolean> {
        try {
            // Test FTS5 with a simple query
            await dbClient.query(`SELECT * FROM nodes_fts LIMIT 1`);
            return true;
        } catch (error) {
            console.error('[FTSSearch] FTS5 not available:', error);
            return false;
        }
    }

    /**
     * Search with boolean operators (FTS5 syntax)
     * Examples:
     * - "ancient AND prophecy"
     * - "dragon OR wyrm"
     * - "magic NOT dark"
     */
    async advancedSearch(
        query: string,
        limit: number = 20
    ): Promise<FTSSearchResult[]> {
        try {
            const sql = `
        SELECT 
          node_id,
          label,
          snippet(nodes_fts, 1, '<mark>', '</mark>', '...', 32) as content,
          rank
        FROM nodes_fts
        WHERE nodes_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `;

            const results = await dbClient.query<FTSSearchResult>(sql, [query, limit]);
            return results;
        } catch (error) {
            console.error('[FTSSearch] Advanced search failed:', error);
            return [];
        }
    }

    /**
     * Search by phrase (exact match)
     */
    async phraseSearch(
        phrase: string,
        limit: number = 20
    ): Promise<FTSSearchResult[]> {
        // FTS5 phrase syntax: "exact phrase"
        const query = `"${phrase}"`;
        return this.search(query, { limit });
    }

    /**
     * Search with prefix matching (for autocomplete)
     */
    async prefixSearch(
        prefix: string,
        limit: number = 10
    ): Promise<FTSSearchResult[]> {
        // FTS5 prefix syntax: term*
        const query = `${prefix}*`;
        return this.search(query, { limit });
    }
}

export const ftsSearch = new FTSSearch();
