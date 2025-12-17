export const WIKILINK_SCHEMA = `
:create wikilink {
    id: Uuid,
    source_note_id: Uuid,
    target_title: String,
    target_note_id: Uuid? default null,
    display_text: String? default null,
    link_type: String default "wikilink",
    context: String? default null,
    char_position: Int? default null,
    created_at: Float default now()
}
`;

export const NOTE_TAG_SCHEMA = `
:create note_tag {
    note_id: Uuid,
    tag: String,
    created_at: Float default now()
    =>
}
`;

export const NOTE_MENTION_SCHEMA = `
:create note_mention {
    id: Uuid,
    note_id: Uuid,
    mention_target: String,
    context: String? default null,
    char_position: Int? default null,
    created_at: Float default now()
}
`;

export const BACKLINK_SCHEMA = `
:create backlink {
    id: Uuid,
    source_note_id: Uuid,
    target_title: String,
    target_note_id: Uuid? default null,
    context: String? default null,
    created_at: Float default now()
}
`;

export const LINKS_SCHEMA = `
${WIKILINK_SCHEMA}
${NOTE_TAG_SCHEMA}
${NOTE_MENTION_SCHEMA}
${BACKLINK_SCHEMA}
`;

export const LINK_QUERIES = {
  upsertWikilink: `
    ?[id, source_note_id, target_title, target_note_id, display_text, link_type, context, char_position, created_at] <- 
      [[$id, $source_note_id, $target_title, $target_note_id, $display_text, $link_type, $context, $char_position, $created_at]]
    :put wikilink {
      id, source_note_id, target_title, target_note_id, display_text, link_type, context, char_position, created_at
    }
  `,

  getOutgoingLinks: `
    ?[id, target_title, target_note_id, display_text, link_type, context, char_position] := 
      *wikilink{id, source_note_id, target_title, target_note_id, display_text, link_type, context, char_position},
      source_note_id == $note_id
  `,

  getBacklinksForNote: `
    ?[source_note_id, source_title, link_type, context] := 
      *wikilink{source_note_id, target_note_id, link_type, context},
      *note{id: source_note_id, title: source_title},
      target_note_id == $note_id
  `,

  getBacklinksByTitle: `
    ?[source_note_id, source_title, link_type, context] := 
      *wikilink{source_note_id, target_title, link_type, context},
      *note{id: source_note_id, title: source_title},
      target_title == $title
  `,

  resolveWikilinks: `
    ?[wikilink_id, target_note_id] := 
      *wikilink{id: wikilink_id, target_title, target_note_id: old_id},
      is_null(old_id),
      *note{id: target_note_id, title: note_title},
      lowercase(target_title) == lowercase(note_title)
  `,

  deleteWikilinksForNote: `
    ?[id] := 
      *wikilink{id, source_note_id},
      source_note_id == $note_id
    :rm wikilink { id }
  `,

  upsertTag: `
    ?[note_id, tag, created_at] <- [[$note_id, $tag, $created_at]]
    :put note_tag { note_id, tag, created_at }
  `,

  getTagsForNote: `
    ?[tag, created_at] := 
      *note_tag{note_id, tag, created_at},
      note_id == $note_id
  `,

  getNotesWithTag: `
    ?[note_id, title] := 
      *note_tag{note_id, tag},
      *note{id: note_id, title},
      tag == $tag
  `,

  getAllTags: `
    ?[tag, count] := 
      *note_tag{tag},
      count = count(tag)
    :order -count
  `,

  deleteTagsForNote: `
    ?[note_id, tag] := 
      *note_tag{note_id, tag},
      note_id == $note_id
    :rm note_tag { note_id, tag }
  `,

  upsertMention: `
    ?[id, note_id, mention_target, context, char_position, created_at] <- 
      [[$id, $note_id, $mention_target, $context, $char_position, $created_at]]
    :put note_mention { id, note_id, mention_target, context, char_position, created_at }
  `,

  getMentionsForNote: `
    ?[id, mention_target, context, char_position] := 
      *note_mention{id, note_id, mention_target, context, char_position},
      note_id == $note_id
  `,

  getMentionsOfTarget: `
    ?[note_id, note_title, context, char_position] := 
      *note_mention{note_id, mention_target, context, char_position},
      *note{id: note_id, title: note_title},
      mention_target == $target
  `,

  deleteMentionsForNote: `
    ?[id] := 
      *note_mention{id, note_id},
      note_id == $note_id
    :rm note_mention { id }
  `,

  upsertBacklink: `
    ?[id, source_note_id, target_title, target_note_id, context, created_at] <- 
      [[$id, $source_note_id, $target_title, $target_note_id, $context, $created_at]]
    :put backlink { id, source_note_id, target_title, target_note_id, context, created_at }
  `,

  getExplicitBacklinks: `
    ?[source_note_id, source_title, context] := 
      *backlink{source_note_id, target_note_id, context},
      *note{id: source_note_id, title: source_title},
      target_note_id == $note_id
  `,
};
