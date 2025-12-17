export const TEMPORAL_PATTERNS = {
    // Pattern 1: Entities at timestamp
    // Note: 'entity' table uses 'created_at' in current schema, mapping to 'valid_at' for consistency
    entitiesAtTimestamp: `
    ?[id, name, entity_kind, valid_at, frequency] := 
      *entity{id, name, entity_kind, created_at: valid_at, frequency} @ $timestamp,
      group_id == $group_id
  `,

    // Pattern 2: Entity version history
    // Note: Only works if entity table has history rows or used with time-travel recursion
    // Using created_at alias for now, though standard *entity query only returns current state
    entityVersionHistory: `
    ?[valid_at, name, summary, attributes] := 
      *entity{id, name, summary, attributes, created_at: valid_at},
      id == $entity_id
    :order valid_at
  `,

    // Pattern 3: Edges valid in date range
    // Edge table explicitly has valid_at/invalid_at
    edgesInDateRange: `
    ?[source_id, target_id, weight, valid_at, invalid_at] := 
      *entity_edge{source_id, target_id, weight, valid_at, invalid_at, group_id},
      group_id == $group_id,
      valid_at >= $start_date,
      valid_at <= $end_date,
      (is_null(invalid_at) or invalid_at > $start_date)
  `,

    // Pattern 4: Episodes created in window
    episodesInWindow: `
    ?[id, content_text, valid_at, note_id] := 
      *episode{id, content_text, valid_at, note_id, group_id},
      group_id == $group_id,
      valid_at >= $start_date,
      valid_at <= $end_date
  `,

    // Helper: Find valid edges at specific timestamp
    activeEdgesAtTimestamp: `
    ?[id, source_id, target_id, weight, valid_at, invalid_at] :=
      *entity_edge{id, source_id, target_id, weight, valid_at, invalid_at, group_id} @ $timestamp,
      group_id == $group_id,
      valid_at <= $timestamp,
      (is_null(invalid_at) or invalid_at > $timestamp)
  `
};
