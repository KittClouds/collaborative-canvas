/**
 * Temporal types for handling narrative time in storytelling
 * Supports everything from precise timestamps to fuzzy narrative time
 */

export type TimeGranularity =
  | 'precise'      // "3:47 PM, March 15, 2024"
  | 'datetime'     // "Morning, Spring 2024"
  | 'date'         // "March 15, 2024"
  | 'relative'     // "Three days after the battle"
  | 'sequential'   // "Chapter 3, Scene 2"
  | 'abstract';    // "In another life" | "Meanwhile"

export type TimeSource = 'explicit' | 'inferred' | 'contextual' | 'manual' | 'parsed';

export type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'midnight';

/**
 * A single point in time within a story
 */
export interface TemporalPoint {
  id: string;
  granularity: TimeGranularity;

  // Absolute time (when available)
  timestamp?: Date;

  // Relative references
  relativeToEventId?: string;
  offsetDays?: number;
  offsetHours?: number;
  offsetValue?: number;
  offsetUnit?: DurationUnit;
  offsetDirection?: 'before' | 'after';

  // Sequential positioning
  chapter?: number;
  act?: number;
  scene?: number;
  sequence?: number;

  // Time of day (for imprecise times)
  timeOfDay?: TimeOfDay;

  // Natural language representation
  displayText: string;
  originalText?: string;

  // Parsing metadata
  confidence: number; // 0-1, how confident we are in the timing
  source: TimeSource;
  locked?: boolean; // prevents auto-updates from parsing
  parsedFrom?: {
    noteId: string;
    textOffset: number;
  };
}

/**
 * A span of time with start and optional end
 */
export interface TemporalSpan {
  start: TemporalPoint;
  end?: TemporalPoint;
  duration?: {
    value: number;
    unit: DurationUnit;
  };
}

/**
 * Context for parsing relative times
 */
export interface ParsingContext {
  referenceEventId?: string;
  referenceTimestamp?: Date;
  storyStartDate?: Date;
  currentChapter?: number;
  currentAct?: number;
}

/**
 * Media reference for timeline cards
 */
export interface MediaReference {
  type: 'IMAGE' | 'VIDEO';
  url: string;
  alt?: string;
}
