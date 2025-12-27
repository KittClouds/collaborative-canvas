/**
 * Entity Projection Queries
 * Scoped for Knowledge Graph (Entity-Relation-Entity).
 */

const sanitize = (str: string) => str.replace(/"/g, '\\"');

export const EntityQueries = {
    /**
     * Global Entity Graph
     * All defined entities and their relationships.
     */
    getAllEntities: () => `
    # Nodes: Entities
    nodes[id, label, type, color, weight] := 
      *entity{id, name, entity_kind, frequency},
      label = name,
      type = entity_kind,
      weight = frequency * 1.0,
      color = "#cccccc" # Default, can be mapped in JS

    # Edges: Entity Relationships
    edges[id, source, target, type, weight] := 
      *entity_edge{id, source_id, target_id, edge_type, confidence},
      source = source_id,
      target = target_id,
      type = edge_type,
      weight = confidence

    # Output Nodes
    ?[id, label, type, metadata, weight, color] := 
      nodes[id, label, type, color, weight],
      metadata = json_object("frequency", weight)

    # Output Edges
    ?[id, source, target, type, weight, metadata] := 
      edges[id, source, target, type, weight],
      metadata = json_object("confidence", weight)
  `,

    /**
     * Note-Scoped Entity Graph
     * Entities mentioned in a specific note and their relationships.
     */
    getNoteEntities: (noteId: string) => `
    $note_id = "${sanitize(noteId)}"

    # 1. Identify entities mentioned in the note
    scope_entities[id] := 
      *note_entity_links{source_id: $note_id, target_id: id}
    
    # 2. Get Entity Details
    nodes[id, label, type, frequency] := 
      scope_entities[id],
      *entity{id, name, entity_kind, frequency},
      label = name,
      type = entity_kind

    # 3. Get Relationships WHERE BOTH entities are in the note
    edges[id, source, target, type, weight] := 
      *entity_edge{id, source_id, target_id, edge_type, confidence},
      scope_entities[source_id],
      scope_entities[target_id],
      source = source_id,
      target = target_id,
      type = edge_type,
      weight = confidence

    # Output
    ?[id, label, type, metadata, weight] := 
      nodes[id, label, type, frequency],
      metadata = json_object("frequency", frequency),
      weight = frequency

    ?[id, source, target, type, weight, metadata] := 
      edges[id, source, target, type, weight],
      metadata = json_object()
  `,

    /**
     * Entity Neighborhood (N-Hop)
     * Entities directly connected to a target entity, up to depth N.
     */
    getEntityNeighborhood: (entityId: string, depth: number = 1) => `
    $start_id = "${sanitize(entityId)}"
    # Limit max depth to prevent explosion
    $max_depth = ${Math.min(depth, 3)}

    # Recursive traversal
    neighborhood[node_id, d] := 
      node_id = $start_id, d = 0
    
    neighborhood[target, d] := 
      neighborhood[source, prev_d],
      *entity_edge{source_id: source, target_id: target},
      d = prev_d + 1,
      d <= $max_depth

    neighborhood[source, d] := 
      neighborhood[target, prev_d],
      *entity_edge{source_id: source, target_id: target},
      d = prev_d + 1,
      d <= $max_depth

    # Fetch Details for collected nodes
    nodes[id, label, type, weight] := 
      neighborhood[id, _],
      *entity{id, name, entity_kind, frequency},
      label = name,
      type = entity_kind,
      weight = frequency

    # Fetch edges within the neighborhood
    edges[id, source, target, type, weight] := 
      *entity_edge{id, source_id, target_id, edge_type, confidence},
      neighborhood[source_id, _],
      neighborhood[target_id, _],
      source = source_id,
      target = target_id,
      type = edge_type,
      weight = confidence

    # Output
    ?[id, label, type, metadata, weight] := 
      nodes[id, label, type, weight],
      metadata = json_object("frequency", weight)

    ?[id, source, target, type, weight, metadata] := 
      edges[id, source, target, type, weight],
      metadata = json_object()
  `
};
