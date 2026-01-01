/**
 * Temporal Mention Schema for CozoDB
 * 
 * Stores temporal expressions detected by the scanner with context.
 * Enables temporal queries and episode-based provenance tracking.
 */

// Temporal kind type (matches Rust TemporalKind)
export type TemporalKind = 'NARRATIVE_MARKER' | 'RELATIVE' | 'CONNECTOR' | 'WEEKDAY' | 'MONTH' | 'TIME_OF_DAY' | 'ERA';

export const TEMPORAL_MENTION_SCHEMA = `
:create temporal_mention {
    id: Uuid,
    episode_id: Uuid?,
    note_id: Uuid,
    
    kind: String,
    text: String,
    start_pos: Int,
    end_pos: Int,
    
    context_sentence: String,
    context_paragraph: String? default null,
    
    confidence: Float default 0.8,
    
    weekday_index: Int? default null,
    month_index: Int? default null,
    narrative_number: Int? default null,
    direction: String? default null,
    era_name: String? default null,
    era_year: Float? default null,
    
    created_at: Float default now()
}
`;

export const TEMPORAL_MENTION_QUERIES = {
  upsert: `
        ?[id, episode_id, note_id, kind, text, start_pos, end_pos,
          context_sentence, context_paragraph, confidence,
          weekday_index, month_index, narrative_number, direction, era_name, era_year, created_at] <- 
          [[$id, $episode_id, $note_id, $kind, $text, $start_pos, $end_pos,
            $context_sentence, $context_paragraph, $confidence,
            $weekday_index, $month_index, $narrative_number, $direction, $era_name, $era_year, $created_at]]
        :put temporal_mention {
            id, episode_id, note_id, kind, text, start_pos, end_pos,
            context_sentence, context_paragraph, confidence,
            weekday_index, month_index, narrative_number, direction, era_name, era_year, created_at
        }
    `,

  upsertBatch: `
        ?[id, episode_id, note_id, kind, text, start_pos, end_pos,
          context_sentence, context_paragraph, confidence,
          weekday_index, month_index, narrative_number, direction, era_name, era_year, created_at] <- $rows
        :put temporal_mention {
            id, episode_id, note_id, kind, text, start_pos, end_pos,
            context_sentence, context_paragraph, confidence,
            weekday_index, month_index, narrative_number, direction, era_name, era_year, created_at
        }
    `,

  getByNoteId: `
        ?[id, kind, text, start_pos, end_pos, context_sentence, confidence,
          weekday_index, month_index, narrative_number, direction, era_name, era_year] := 
          *temporal_mention{id, note_id, kind, text, start_pos, end_pos, context_sentence, confidence,
            weekday_index, month_index, narrative_number, direction, era_name, era_year},
          note_id == $note_id
        :order start_pos
    `,

  getByKind: `
        ?[id, note_id, text, start_pos, end_pos, context_sentence, confidence,
          weekday_index, month_index, narrative_number, direction, era_name, era_year] := 
          *temporal_mention{id, note_id, kind, text, start_pos, end_pos, context_sentence, confidence,
            weekday_index, month_index, narrative_number, direction, era_name, era_year},
          kind == $kind
        :order start_pos
    `,

  getByEraName: `
        ?[id, note_id, text, era_year, context_sentence, start_pos] := 
          *temporal_mention{id, note_id, kind, text, era_name, era_year, context_sentence, start_pos},
          kind == "ERA",
          era_name == $era_name
        :order era_year
    `,

  getWithContext: `
        ?[id, kind, text, context_sentence, context_paragraph, note_title, note_id] := 
          *temporal_mention{id, note_id, kind, text, context_sentence, context_paragraph},
          *note{id: note_id, title: note_title}
        :order kind, text
    `,

  deleteByNoteId: `
        ?[id] := 
          *temporal_mention{id, note_id},
          note_id == $note_id
        :rm temporal_mention { id }
    `,

  delete: `
        ?[id] <- [[$id]]
        :rm temporal_mention { id }
    `,

  getTimelineOrder: `
        ?[id, kind, text, start_pos, era_name, era_year, narrative_number,
          weekday_index, month_index, context_sentence, note_id] := 
          *temporal_mention{id, note_id, kind, text, start_pos, era_name, era_year, 
            narrative_number, weekday_index, month_index, context_sentence}
        :order note_id, start_pos
    `,

  countByKind: `
        ?[kind, count] := 
          *temporal_mention{kind},
          count = count(kind)
        :order -count
    `,
};

// Type for persisting temporal mentions
export interface TemporalMentionRow {
  id: string;
  episodeId: string | null;
  noteId: string;
  kind: TemporalKind;
  text: string;
  startPos: number;
  endPos: number;
  contextSentence: string;
  contextParagraph?: string;
  confidence: number;
  weekdayIndex?: number;
  monthIndex?: number;
  narrativeNumber?: number;
  direction?: string;
  eraName?: string;
  eraYear?: number;
  createdAt: number;
}
