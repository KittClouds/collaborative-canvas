/**
 * Concept Projection Queries
 * Scoped for Text Analysis / Co-Occurrence Graphs.
 */

const sanitize = (str: string) => str.replace(/"/g, '\\"');

export const ConceptQueries = {
    /**
     * Note Co-Occurrence Graph
     * Terms that appear near each other in a specific note.
     */
    getNoteCoOccurrence: (noteId: string) => `
    $note_id = "${sanitize(noteId)}"

    # NOTE: Assuming tables 'term' and 'term_cooccurrence' exist based on prompt.
    # If not, this query will need schema created first. 
    # Fallback logic relies on potential keyword extraction stored in JSON or elsewhere.
    
    # Check for direct cooccurrence table
    edges[source, target, weight] := 
      *term_cooccurrence{note_id, term1, term2, frequency},
      note_id == $note_id,
      source = term1,
      target = term2,
      weight = frequency

    # Collect nodes from edges
    relevant_terms[term] := edges[term, _, _]
    relevant_terms[term] := edges[_, term, _]

    # Get term details
    nodes[id, label, weight] := 
      relevant_terms[id],
      label = id,
      weight = 1 # Simple frequency placeholder

    # Output Nodes
    ?[id, label, type, metadata, weight] := 
      nodes[id, label, weight],
      type = "concept",
      metadata = json_object(),
      weight = weight

    # Output Edges (synthetic ID)
    ?[id, source, target, type, weight, metadata] := 
      edges[source, target, weight],
      id = concat(source, "_", target), 
      type = "co_occurrence",
      metadata = json_object("weight", weight)
  `,

    /**
     * Folder Co-Occurrence Graph
     * Aggregated co-occurrence across all notes in a folder.
     */
    getFolderCoOccurrence: (folderId: string) => `
    $folder_id = "${sanitize(folderId)}"

    # Get notes in folder
    folder_notes[note_id] := 
      *folder_hierarchy{parent_id: $folder_id, child_id: note_id, child_entity_kind: "NOTE"}

    # Aggregate edges across these notes
    raw_edges[source, target, weight] := 
      folder_notes[note_id],
      *term_cooccurrence{note_id, term1, term2, frequency},
      source = term1,
      target = term2,
      weight = frequency

    # Sum weights (manual aggregation typically needed if Cozo doesn't auto-sum in projections)
    # Using 'reduce' or just grouping
    edge_agg[source, target, total_weight] := 
      raw_edges[source, target, w],
      total_weight = sum(w)

    nodes[id] := edge_agg[id, _, _]
    nodes[id] := edge_agg[_, id, _]

    ?[id, label, type, metadata, weight] := 
      nodes[id],
      label = id,
      type = "concept",
      metadata = json_object(),
      weight = 1

    ?[id, source, target, type, weight, metadata] := 
      edge_agg[source, target, weight],
      id = concat(source, "_", target),
      type = "aggregated_co_occurrence",
      metadata = json_object()
  `
};
