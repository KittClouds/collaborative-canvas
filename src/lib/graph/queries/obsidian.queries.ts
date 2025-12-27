/**
 * Obsidian Projection Queries
 * Scoped for Note-to-Note graphs (Wikilinks/Backlinks).
 */



// Helper to sanitize inputs (basic string escaping)
const sanitize = (str: string) => str.replace(/"/g, '\\"');

export const ObsidianQueries = {
    /**
     * Global Note Graph
     * Returns all notes and their connections.
     */
    getAllNotesAndLinks: () => `
    # Get all notes with metadata
    note_nodes[id, label, type, word_count, created_at] := 
      *note{id, title, content, created_at},
      label = title,
      type = "note",
      word_count = length(content)

    # Get links between notes (assuming note_entity_links handles direct links too, 
    # or we filter for target_id in note_nodes)
    note_links[id, source, target, type, weight] := 
      *note_entity_links{id, source_id, target_id, link_type, relevance},
      source = source_id,
      target = target_id,
      type = link_type,
      weight = relevance,
      note_nodes[source, _, _, _, _],
      note_nodes[target, _, _, _, _]

    # Calculate node degrees for sizing
    node_degree[id, degree] := 
      note_links[_, id, _, _, _],
      degree = count(id)

    # Output Nodes
    ?[id, label, type, metadata, weight] := 
      note_nodes[id, label, type, word_count, created_at],
      degree = 1, # Default
      # Try to attach degree if available, efficiently
      metadata = json_object("word_count", word_count, "created_at", created_at),
      weight = 1

    # Output Edges
    ?[id, source, target, type, weight, metadata] := 
      note_links[id, source, target, type, weight],
      metadata = json_object("type", type)
  `,

    /**
     * Folder-Scoped Note Graph
     * Returns notes within a folder and links between them.
     */
    getFolderNotesAndLinks: (folderId: string) => `
    # input: folderId
    $folder_id = "${sanitize(folderId)}"

    # Recursive folder descendants
    folder_tree[id] := *folder_hierarchy{parent_id: $folder_id, child_id: id}
    folder_tree[id] := folder_tree[parent], *folder_hierarchy{parent_id: parent, child_id: id}
    
    # Include the root folder itself if needed, or just its children
    # We want Notes that are children of these folders
    
    scope_notes[id] := 
      folder_tree[folder_id],
      *folder_hierarchy{parent_id: folder_id, child_id: id, child_entity_kind: "NOTE"}
    
    # Also include direct children of the target folder
    scope_notes[id] := 
      *folder_hierarchy{parent_id: $folder_id, child_id: id, child_entity_kind: "NOTE"}

    # Get Note Data
    note_nodes[id, label, type, created_at] := 
      scope_notes[id],
      *note{id, title, created_at},
      label = title,
      type = "note"

    # Get Links where BOTH ends are in scope
    note_links[id, source, target, type, weight] := 
      *note_entity_links{id, source_id, target_id, link_type, relevance},
      scope_notes[source_id],
      scope_notes[target_id],
      source = source_id,
      target = target_id,
      type = link_type,
      weight = relevance

    # Output Nodes
    ?[id, label, type, metadata, weight] := 
      note_nodes[id, label, type, created_at],
      metadata = json_object("created_at", created_at),
      weight = 1

    # Output Edges
    ?[id, source, target, type, weight, metadata] := 
      note_links[id, source, target, type, weight],
      metadata = json_object()
  `,

    /**
     * Backlink Graph for a Specific Note
     * Returns the note, notes that link to it, and their inter-links.
     */
    getBacklinksForNote: (noteId: string) => `
    # input: noteId
    $target_id = "${sanitize(noteId)}"

    # 1. Target Note
    core_nodes[id] := *note{id}, id == $target_id

    # 2. Notes linking TO the target
    # Looking at entity_backlinks or note_entity_links where target is our note
    backlink_nodes[id] := 
      *note_entity_links{source_id: id, target_id: $target_id},
      *note{id}
    
    # 3. Notes the target links TO
    outgoing_nodes[id] := 
      *note_entity_links{source_id: $target_id, target_id: id},
      *note{id}

    # Consolidated Scope
    scope[id] := core_nodes[id]
    scope[id] := backlink_nodes[id]
    scope[id] := outgoing_nodes[id]

    # Node Details
    nodes[id, label, type] := 
      scope[id],
      *note{id, title},
      label = title,
      type = "note"

    # Edge Details (only edges within scope)
    links[id, source, target, type] := 
      *note_entity_links{id, source_id, target_id, link_type},
      scope[source_id],
      scope[target_id],
      source = source_id,
      target = target_id,
      type = link_type

    # Output
    ?[id, label, type, metadata, weight] := 
      nodes[id, label, type],
      metadata = json_object(),
      weight = 1

    ?[id, source, target, type, weight, metadata] := 
      links[id, source, target, type],
      weight = 1,
      metadata = json_object()
  `
};
