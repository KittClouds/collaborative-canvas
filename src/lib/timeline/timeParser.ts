/**
 * TimeParser - Parse natural language into structured temporal data
 * Handles precise dates, relative times, sequential markers, and abstract time
 */

import * as chrono from 'chrono-node';
import { TemporalPoint, TimeGranularity, ParsingContext, DurationUnit } from '@/types/temporal';

export class TimeParser {
  private referencePoints = new Map<string, Date>();
  private sequenceCounter = { chapter: 0, act: 0, scene: 0 };

  /**
   * Parse a natural language time string into a TemporalPoint
   */
  parse(input: string, context?: ParsingContext): TemporalPoint {
    const trimmed = input.trim();
    
    // Try absolute date parsing first using chrono-node
    const chronoParsed = chrono.parse(trimmed, context?.referenceTimestamp);
    if (chronoParsed.length > 0) {
      return this.createPrecisePoint(chronoParsed[0], trimmed);
    }

    // Relative time patterns
    if (this.isRelativeTime(trimmed)) {
      return this.parseRelativeTime(trimmed, context);
    }

    // Sequential indicators (Chapter X, Act Y, Scene Z)
    if (this.isSequential(trimmed)) {
      return this.parseSequential(trimmed);
    }

    // Abstract/metaphorical time
    return this.createAbstractPoint(trimmed);
  }

  /**
   * Register a reference point for relative time calculations
   */
  registerReferencePoint(eventId: string, timestamp: Date): void {
    this.referencePoints.set(eventId, timestamp);
  }

  /**
   * Get a reference point's timestamp
   */
  getReferencePoint(eventId: string): Date | undefined {
    return this.referencePoints.get(eventId);
  }

  /**
   * Create a precise temporal point from chrono-node parsing
   */
  private createPrecisePoint(parsed: chrono.ParsedResult, original: string): TemporalPoint {
    const startDate = parsed.start.date();
    const isCertain = parsed.start.isCertain('day') && 
                      parsed.start.isCertain('month') && 
                      parsed.start.isCertain('year');
    
    return {
      id: crypto.randomUUID(),
      granularity: isCertain ? 'precise' : 'datetime',
      timestamp: startDate,
      displayText: original,
      confidence: isCertain ? 0.95 : 0.7,
      source: 'explicit'
    };
  }

  /**
   * Check if input contains relative time indicators
   */
  private isRelativeTime(input: string): boolean {
    const relativePatterns = [
      /\d+\s+(day|hour|week|month|year)s?\s+(after|before|later|earlier)/i,
      /(next|previous|following|prior)\s+(morning|evening|day|week)/i,
      /(the\s+)?(morning|evening|night)\s+(after|before|of|following)/i,
      /later\s+that\s+(day|night|evening|morning)/i,
      /the\s+same\s+(day|night|evening|morning)/i,
    ];
    return relativePatterns.some(pattern => pattern.test(input));
  }

  /**
   * Parse relative time expressions
   */
  private parseRelativeTime(input: string, context?: ParsingContext): TemporalPoint {
    // Pattern: "X days/hours/weeks after/before [event]"
    const offsetMatch = input.match(
      /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+(after|before|later|earlier)/i
    );

    if (offsetMatch) {
      const [, amount, unit, direction] = offsetMatch;
      const offsetDays = this.convertToOffset(
        parseInt(amount), 
        unit.toLowerCase() as DurationUnit, 
        direction.toLowerCase()
      );

      return {
        id: crypto.randomUUID(),
        granularity: 'relative',
        relativeToEventId: context?.referenceEventId,
        offsetDays,
        displayText: input,
        confidence: 0.8,
        source: context?.referenceEventId ? 'contextual' : 'inferred'
      };
    }

    // Pattern: "the morning/evening after/before"
    const periodMatch = input.match(
      /(the\s+)?(morning|evening|night|afternoon)\s+(after|before|of|following)/i
    );

    if (periodMatch) {
      const [, , period, direction] = periodMatch;
      const offsetDays = direction.toLowerCase() === 'before' ? -1 : 
                         direction.toLowerCase() === 'after' || direction.toLowerCase() === 'following' ? 1 : 0;
      
      return {
        id: crypto.randomUUID(),
        granularity: 'relative',
        relativeToEventId: context?.referenceEventId,
        offsetDays,
        displayText: input,
        confidence: 0.75,
        source: 'contextual'
      };
    }

    // Pattern: "later that day/evening"
    const sameDayMatch = input.match(/later\s+that\s+(day|night|evening|morning)/i);
    if (sameDayMatch) {
      return {
        id: crypto.randomUUID(),
        granularity: 'relative',
        relativeToEventId: context?.referenceEventId,
        offsetDays: 0,
        offsetHours: 4, // approximate "later"
        displayText: input,
        confidence: 0.7,
        source: 'contextual'
      };
    }

    return this.createAbstractPoint(input);
  }

  /**
   * Check if input contains sequential markers
   */
  private isSequential(input: string): boolean {
    return /\b(chapter|act|scene|part|book|episode|sequence)\s+\d+/i.test(input) ||
           /^#\d+$/i.test(input) ||
           /\bch\.?\s*\d+/i.test(input);
  }

  /**
   * Parse sequential time markers (Chapter X, Act Y, Scene Z)
   */
  private parseSequential(input: string): TemporalPoint {
    const patterns = {
      chapter: /(?:chapter|ch\.?)\s*(\d+)/i,
      act: /act\s*(\d+)/i,
      scene: /scene\s*(\d+)/i,
      sequence: /#(\d+)/i,
    };

    const result: Partial<TemporalPoint> = {
      id: crypto.randomUUID(),
      granularity: 'sequential',
      displayText: input,
      confidence: 1.0,
      source: 'explicit'
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = input.match(pattern);
      if (match) {
        (result as any)[key] = parseInt(match[1]);
      }
    }

    // Calculate a sequence number for sorting
    result.sequence = (result.chapter || 0) * 10000 + 
                      (result.act || 0) * 100 + 
                      (result.sequence || 0);

    return result as TemporalPoint;
  }

  /**
   * Create an abstract temporal point for metaphorical/fuzzy time
   */
  private createAbstractPoint(input: string): TemporalPoint {
    // Detect common abstract time phrases for confidence scoring
    const abstractPatterns = [
      { pattern: /^(meanwhile|in the meantime|at the same time)/i, confidence: 0.6 },
      { pattern: /^(long ago|once upon a time|in ancient times)/i, confidence: 0.3 },
      { pattern: /^(in another life|in a dream|somewhere in time)/i, confidence: 0.2 },
      { pattern: /^(eventually|soon|later|afterwards)/i, confidence: 0.5 },
    ];

    let confidence = 0.4; // default for unknown abstract time
    for (const { pattern, confidence: c } of abstractPatterns) {
      if (pattern.test(input)) {
        confidence = c;
        break;
      }
    }

    return {
      id: crypto.randomUUID(),
      granularity: 'abstract',
      displayText: input,
      confidence,
      source: 'explicit'
    };
  }

  /**
   * Convert time offset to days
   */
  private convertToOffset(amount: number, unit: string, direction: string): number {
    const multipliers: Record<string, number> = {
      second: 1 / 86400,
      minute: 1 / 1440,
      hour: 1 / 24,
      day: 1,
      week: 7,
      month: 30,
      year: 365,
    };

    const multiplier = multipliers[unit] || 1;
    const sign = ['before', 'earlier'].includes(direction) ? -1 : 1;
    
    return amount * multiplier * sign;
  }

  /**
   * Format a TemporalPoint for display
   */
  static formatDisplay(point: TemporalPoint, format: 'full' | 'short' = 'full'): string {
    switch (point.granularity) {
      case 'precise':
        return format === 'full'
          ? point.timestamp?.toLocaleString() || point.displayText
          : point.timestamp?.toLocaleDateString() || point.displayText;

      case 'datetime':
        return point.displayText;

      case 'sequential':
        const parts: string[] = [];
        if (point.chapter) parts.push(`Ch. ${point.chapter}`);
        if (point.act) parts.push(`Act ${point.act}`);
        if (format === 'full' && point.sequence && point.sequence < 100) {
          parts.push(`#${point.sequence}`);
        }
        return parts.length > 0 ? parts.join(', ') : point.displayText;

      case 'relative':
      case 'abstract':
      default:
        return point.displayText;
    }
  }
}

// Export singleton instance
export const timeParser = new TimeParser();
