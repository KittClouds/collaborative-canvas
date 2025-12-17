export const TEMPORAL_POINT_SCHEMA = `
:create temporal_point {
    id: Uuid,
    entity_id: Uuid,
    
    granularity: String default "sequential",
    
    timestamp: Float? default null,
    
    relative_to_event_id: Uuid? default null,
    offset_value: Int? default null,
    offset_unit: String? default null,
    offset_direction: String? default null,
    
    chapter: Int? default null,
    act: Int? default null,
    scene: Int? default null,
    sequence: Int? default null,
    time_of_day: String? default null,
    
    display_text: String,
    original_text: String? default null,
    
    confidence: Float default 1.0,
    source: String default "manual",
    locked: Bool default false,
    
    parsed_from_note_id: Uuid? default null,
    parsed_from_offset: Int? default null
}
`;

export const GRANULARITY_TYPES = [
  'precise',
  'datetime',
  'date',
  'relative',
  'sequential',
  'abstract',
] as const;

export type TemporalGranularity = typeof GRANULARITY_TYPES[number];

export const TIME_OF_DAY_VALUES = [
  'dawn',
  'morning',
  'afternoon',
  'evening',
  'night',
  'midnight',
] as const;

export type TimeOfDay = typeof TIME_OF_DAY_VALUES[number];

export const DURATION_UNITS = [
  'seconds',
  'minutes',
  'hours',
  'days',
  'weeks',
  'months',
  'years',
] as const;

export type DurationUnit = typeof DURATION_UNITS[number];

export const TIME_SOURCE_VALUES = [
  'explicit',
  'inferred',
  'contextual',
  'manual',
  'parsed',
] as const;

export type TimeSource = typeof TIME_SOURCE_VALUES[number];

export const TEMPORAL_QUERIES = {
  upsert: `
    ?[id, entity_id, granularity, timestamp, relative_to_event_id, offset_value,
      offset_unit, offset_direction, chapter, act, scene, sequence, time_of_day,
      display_text, original_text, confidence, source, locked,
      parsed_from_note_id, parsed_from_offset] <- 
      [[$id, $entity_id, $granularity, $timestamp, $relative_to_event_id, $offset_value,
        $offset_unit, $offset_direction, $chapter, $act, $scene, $sequence, $time_of_day,
        $display_text, $original_text, $confidence, $source, $locked,
        $parsed_from_note_id, $parsed_from_offset]]
    :put temporal_point {
      id, entity_id, granularity, timestamp, relative_to_event_id, offset_value,
      offset_unit, offset_direction, chapter, act, scene, sequence, time_of_day,
      display_text, original_text, confidence, source, locked,
      parsed_from_note_id, parsed_from_offset
    }
  `,

  getById: `
    ?[id, entity_id, granularity, timestamp, relative_to_event_id, offset_value,
      offset_unit, offset_direction, chapter, act, scene, sequence, time_of_day,
      display_text, original_text, confidence, source, locked,
      parsed_from_note_id, parsed_from_offset] := 
      *temporal_point{id, entity_id, granularity, timestamp, relative_to_event_id, offset_value,
        offset_unit, offset_direction, chapter, act, scene, sequence, time_of_day,
        display_text, original_text, confidence, source, locked,
        parsed_from_note_id, parsed_from_offset},
      id == $id
  `,

  getByEntityId: `
    ?[id, granularity, timestamp, chapter, act, scene, sequence, time_of_day,
      display_text, confidence, source, locked] := 
      *temporal_point{id, entity_id, granularity, timestamp, chapter, act, scene, sequence,
        time_of_day, display_text, confidence, source, locked},
      entity_id == $entity_id
  `,

  getByChapterScene: `
    ?[id, entity_id, entity_name, entity_kind, sequence, time_of_day, display_text] := 
      *temporal_point{id, entity_id, chapter, scene, sequence, time_of_day, display_text},
      *entity{id: entity_id, name: entity_name, entity_kind},
      chapter == $chapter,
      scene == $scene
    :order sequence
  `,

  getByChapter: `
    ?[id, entity_id, entity_name, entity_kind, scene, sequence, display_text] := 
      *temporal_point{id, entity_id, chapter, scene, sequence, display_text},
      *entity{id: entity_id, name: entity_name, entity_kind},
      chapter == $chapter
    :order scene, sequence
  `,

  getByAct: `
    ?[id, entity_id, entity_name, entity_kind, chapter, scene, sequence, display_text] := 
      *temporal_point{id, entity_id, act, chapter, scene, sequence, display_text},
      *entity{id: entity_id, name: entity_name, entity_kind},
      act == $act
    :order chapter, scene, sequence
  `,

  getByTimestamp: `
    ?[id, entity_id, entity_name, entity_kind, timestamp, display_text] := 
      *temporal_point{id, entity_id, timestamp, display_text},
      *entity{id: entity_id, name: entity_name, entity_kind},
      timestamp != null,
      timestamp >= $start_time,
      timestamp <= $end_time
    :order timestamp
  `,

  getRelativeEvents: `
    ?[id, entity_id, entity_name, offset_value, offset_unit, offset_direction, display_text] := 
      *temporal_point{id, entity_id, relative_to_event_id, offset_value, offset_unit, offset_direction, display_text},
      *entity{id: entity_id, name: entity_name},
      relative_to_event_id == $reference_event_id
    :order offset_direction, offset_value
  `,

  getByTimeOfDay: `
    ?[id, entity_id, entity_name, chapter, scene, sequence, display_text] := 
      *temporal_point{id, entity_id, chapter, scene, sequence, time_of_day, display_text},
      *entity{id: entity_id, name: entity_name},
      time_of_day == $time_of_day
    :order chapter, scene, sequence
  `,

  getTimelineOrder: `
    ?[entity_id, entity_name, entity_kind, display_text, sort_key] := 
      *temporal_point{entity_id, chapter, scene, sequence, display_text},
      *entity{id: entity_id, name: entity_name, entity_kind},
      entity_kind in ["SCENE", "EVENT"],
      sort_key = chapter * 10000 + scene * 100 + coalesce(sequence, 0)
    :order sort_key
  `,

  updateDisplayText: `
    ?[id, display_text] <- [[$id, $display_text]]
    :update temporal_point { id => display_text }
  `,

  lockTemporalPoint: `
    ?[id, locked] <- [[$id, true]]
    :update temporal_point { id => locked }
  `,

  unlockTemporalPoint: `
    ?[id, locked] <- [[$id, false]]
    :update temporal_point { id => locked }
  `,

  getUnlockedPoints: `
    ?[id, entity_id, display_text, source] := 
      *temporal_point{id, entity_id, display_text, source, locked},
      locked == false
  `,

  delete: `
    ?[id] <- [[$id]]
    :rm temporal_point { id }
  `,

  deleteByEntityId: `
    ?[id] := 
      *temporal_point{id, entity_id},
      entity_id == $entity_id
    :rm temporal_point { id }
  `,

  getChronologicalTimeline: `
    ?[entity_id, entity_name, entity_kind, chapter, scene, sequence, time_of_day, display_text] := 
      *temporal_point{entity_id, chapter, scene, sequence, time_of_day, display_text},
      *entity{id: entity_id, name: entity_name, entity_kind},
      chapter != null
    :order chapter, scene, sequence
  `,

  getAbstractTimeEvents: `
    ?[entity_id, entity_name, display_text, original_text] := 
      *temporal_point{entity_id, granularity, display_text, original_text},
      *entity{id: entity_id, name: entity_name},
      granularity == "abstract"
  `,
};
