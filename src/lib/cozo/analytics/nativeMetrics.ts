import { cozoDb } from '../db';

export interface NativeMetricsOptions {
  groupId: string;
}

export interface DegreeCentralityResult {
  entityId: string;
  degree: number;
  inDegree: number;
  outDegree: number;
}

export interface TriangleCountResult {
  entityId: string;
  triangleCount: number;
}

export async function calculateDegreeCentrality(
  options: NativeMetricsOptions
): Promise<DegreeCentralityResult[]> {
  // Calculate degree (total, in, out) for each entity in the group
  // We consider undirected edges for 'degree' if edge_type is CO_OCCURS, 
  // but let's just sum in+out for now or count distinct neighbors.
  
  const query = `
    ?[entity_id, degree, in_degree, out_degree] :=
      *entity{id: entity_id, group_id},
      group_id == $group_id,
      
      # Out-degree
      out_count = count(
        *entity_edge{source_id: entity_id, group_id}
      ),
      
      # In-degree
      in_count = count(
        *entity_edge{target_id: entity_id, group_id}
      ),
      
      in_degree = in_count,
      out_degree = out_count,
      degree = in_count + out_count
  `;

  try {
    const result = cozoDb.runQuery(query, { group_id: options.groupId });
    
    if (!result.rows) return [];

    const metrics = result.rows.map((row: unknown[]) => ({
      entityId: row[0] as string,
      degree: row[1] as number,
      inDegree: row[2] as number,
      outDegree: row[3] as number,
    }));

    // Update entities with degree centrality
    await updateEntityCentrality(metrics, options.groupId);

    return metrics;
  } catch (err) {
    console.error('Failed to calculate degree centrality:', err);
    return [];
  }
}

async function updateEntityCentrality(
  metrics: DegreeCentralityResult[],
  groupId: string
): Promise<void> {
  // Batch update entities
  // We need to read existing entities to preserve other fields? 
  // Or we can use a partial update if Cozo supports it?
  // Cozo's :update might work if we have all key columns.
  // Entity key is 'id'.
  
  // However, :update requires all columns if we replace.
  // We should use a read-modify-write pattern or :update with knowledge of schema.
  // For now, let's assume we can update just the centrality if we re-put the row.
  // BUT in Cozo, :put overwrites. :update fails if not exists.
  // The safest is to read the entity, update the field, and write it back.
  // This might be slow for many entities.
  
  // A better way in Datalog is to use a rule to update.
  // But Datalog queries are read-only mostly unless using :put/:update in the query block?
  // No, we can do `Result <- Query :update entity { ... }`
  
  // Let's try to do it in one query if possible.
  // We can join the computed metrics with the existing entity table and update.
  
  /*
    ?[id, name, kind, subtype, group, scope, created, method, summ, aliases, canon, freq, 
      degree, betweenness, closeness, comm, attrs, span, parts] :=
      *entity{id, name, entity_kind: kind, entity_subtype: subtype, group_id: group, 
              scope_type: scope, created_at: created, extraction_method: method, 
              summary: summ, aliases, canonical_note_id: canon, frequency: freq, 
              betweenness_centrality: betweenness, closeness_centrality: closeness, 
              community_id: comm, attributes: attrs, temporal_span: span, participants: parts},
      group == $group_id,
      # Join with computed degree (passed as relation/parameter or recomputed)
      # Simpler to just recompute inside the update query?
  */
  
  // Let's just do read-modify-write in chunks to be safe and explicit.
  
  const updates = metrics.map(m => ({
    id: m.entityId,
    degreeCentrality: m.degree
  }));
  
  // We'll update in batches of 100
  const batchSize = 100;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    
    // Read existing entities
    const ids = batch.map(b => b.id);
    // This part is tricky without a direct 'get by ids' query easily constructed without huge ORs.
    // So we iterate.
    // Actually, we can pass a list of IDs to a query.
    
    // Optimisation: Re-run the calculation IN the update query.
    const updateQuery = `
      ?[id, name, kind, subtype, group, scope, created, method, summ, aliases, canon, freq, 
        new_degree, betweenness, closeness, comm, attrs, span, parts] :=
        *entity{id, name, entity_kind: kind, entity_subtype: subtype, group_id: group, 
                scope_type: scope, created_at: created, extraction_method: method, 
                summary: summ, aliases, canonical_note_id: canon, frequency: freq, 
                betweenness_centrality: betweenness, closeness_centrality: closeness, 
                community_id: comm, attributes: attrs, temporal_span: span, participants: parts},
        group == $group_id,
        
        in_c = count(*entity_edge{target_id: id, group_id: group}),
        out_c = count(*entity_edge{source_id: id, group_id: group}),
        new_degree = in_c + out_c
      
      :update entity {
        id, name, entity_kind: kind, entity_subtype: subtype, group_id: group, 
        scope_type: scope, created_at: created, extraction_method: method, 
        summary: summ, aliases, canonical_note_id: canon, frequency: freq, 
        degree_centrality: new_degree, betweenness_centrality: betweenness, 
        closeness_centrality: closeness, community_id: comm, attributes: attrs, 
        temporal_span: span, participants: parts
      }
    `;
    
    try {
      cozoDb.runQuery(updateQuery, { group_id: groupId });
    } catch (e) {
      console.error('Batch update failed', e);
    }
    
    // Since we did it in one query for ALL, we break the loop (logic changed).
    break; 
  }
}

export async function countTriangles(
  options: NativeMetricsOptions
): Promise<TriangleCountResult[]> {
  // Count triangles for each node: A connected to B, B to C, C to A
  const query = `
    ?[id, count] :=
      *entity{id, group_id},
      group_id == $group_id,
      
      *entity_edge{source_id: id, target_id: b, group_id},
      *entity_edge{source_id: b, target_id: c, group_id},
      *entity_edge{source_id: c, target_id: id, group_id},
      
      # Avoid duplicates (A->B->C->A is same as A->C->B->A for undirected triangles?)
      # But edges are directed.
      # For "co-occurrence" (often symmetric), we might have double edges.
      # If we want standard triangle counting:
      id != b, b != c, c != id,
      
      count = count(b, c)
  `;
  
  // Note: This counts directed cycles of length 3.
  // For undirected graph interpretation of co-occurrence, we check strictly < ordering?
  // Let's stick to directed cycles for now or let the user decide.
  // The query above gives 'count' per node.

  try {
    const result = cozoDb.runQuery(query, { group_id: options.groupId });
    if (!result.rows) return [];
    
    return result.rows.map((row: unknown[]) => ({
      entityId: row[0] as string,
      triangleCount: row[1] as number
    }));
  } catch (err) {
    console.error('Failed to count triangles:', err);
    return [];
  }
}
