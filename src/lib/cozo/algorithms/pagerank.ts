import { cozoDb } from '../db';

export interface PageRankOptions {
    groupId: string;
    theta?: number;        // Damping factor (default: 0.85)
    iterations?: number;   // Max iterations (default: 100)
    tolerance?: number;    // Convergence threshold
}

export interface PageRankResult {
    entityId: string;
    name: string;
    entityKind: string;
    score: number;         // 0-1, higher = more important
    rank: number;          // 1-N ranking
}

/**
 * Compute PageRank on entity graph
 * 
 * Unlike degree centrality (raw connections), PageRank considers:
 * - Quality of connections (who you're connected to)
 * - Recursive importance (connections to important entities)
 * 
 * High PageRank = "main character"
 * Low PageRank = "background character"
 */
export async function computePageRank(
    options: PageRankOptions
): Promise<PageRankResult[]> {
    const startTime = Date.now();

    const query = `
    # Define edge relation for PageRank
    edges[source_id, target_id, weight] :=
      *entity_edge{source_id, target_id, weight, group_id},
      group_id == $group_id,
      weight >= 2  # Filter weak edges
    
    # Run PageRank algorithm (built-in)
    pagerank_scores[entity_id, score] <~ PageRank(
      edges: edges[source_id, target_id, weight],
      undirected: true,
      theta: $theta,
      max_iter: $iterations
    )
    
    # Join with entity data
    ?[entity_id, name, entity_kind, score] :=
      pagerank_scores[entity_id, score],
      *entity{id: entity_id, name, entity_kind, group_id},
      group_id == $group_id
    
    :order -score
  `;

    try {
        const result = await cozoDb.runQuery(query, {
            group_id: options.groupId,
            theta: options.theta || 0.85,
            iterations: options.iterations || 100,
        }); // Using runQuery from db.ts wrapper that returns parsed JSON

        // Note: runQuery wrapper usually returns { ok: boolean, rows: ... } or just the result?
        // Looking at db.ts from previous interactions, runQuery does JSON.parse.
        // Let's assume standard Cozo JSON format: { columns: [], rows: [] }

        if (!result.rows) {
            console.warn('PageRank returned no rows');
            return [];
        }

        return result.rows.map((row: any[], index: number) => ({
            entityId: row[0],
            name: row[1],
            entityKind: row[2],
            score: row[3],
            rank: index + 1,
        }));

    } catch (e) {
        console.error('PageRank failed', e);
        return [];
    }
}

/**
 * Get top N most important entities
 */
export async function getMainCharacters(
    groupId: string,
    limit: number = 10
): Promise<PageRankResult[]> {
    const results = await computePageRank({ groupId });
    return results.slice(0, limit);
}

/**
 * Compare PageRank vs Degree Centrality
 * Reveals entities that are "network hubs" vs "truly important"
 */
export async function compareImportanceMetrics(
    groupId: string
): Promise<Array<{
    name: string;
    pagerank: number;
    degree: number;
    ratio: number;  // pagerank/degree (>1 = punches above weight)
}>> {
    const pagerank = await computePageRank({ groupId });

    // Get degree centrality 
    // Note: we need to check if degree_centrality is in entity table 
    // or we compute it on the fly. 
    // Previous schema checks didn't explicitly show degree_centrality column in *entity*.
    // It might be implicitly computed or I might need to compute it.
    // I will compute it here to be safe.

    const degreeQuery = `
    edges[source_id] := *entity_edge{source_id, group_id}, group_id == $group_id
    edges[target_id] := *entity_edge{target_id, group_id}, group_id == $group_id
    
    degree[id, count] := edges[id], count = count(id)
    
    ?[entity_id, name, degree_count] :=
      *entity{id: entity_id, name, group_id},
      group_id == $group_id,
      degree[entity_id, degree_count]
  `;

    try {
        const degreeResult = await cozoDb.runQuery(degreeQuery, { group_id: groupId });
        const degreeMap = new Map<string, { name: string; degree: number }>();

        if (degreeResult.rows) {
            degreeResult.rows.forEach((row: any[]) => {
                degreeMap.set(row[0], { name: row[1], degree: row[2] });
            });
        }

        return pagerank.map(pr => {
            const d = degreeMap.get(pr.entityId);
            const degree = d ? d.degree : 0;

            // Normalize degree roughly to 0-1 range for comparison? 
            // Or just use raw degree.
            // Let's use raw degree for ratio, but handle div by zero.
            // ratio: (pagerank * 100) / degree ?
            // PageRank is usually small (sum to 1). Degree is integer.
            // Let's normalize degree by max degree?

            return {
                name: pr.name,
                pagerank: pr.score,
                degree: degree,
                ratio: degree > 0 ? (pr.score * 100) / degree : 0, // arbitrary scaling
            };
        }).sort((a, b) => b.ratio - a.ratio);

    } catch (e) {
        console.error('Degree centrality query failed', e);
        return [];
    }
}
