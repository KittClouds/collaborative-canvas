/**
 * StoryTimelineBuilder - Build react-chrono timeline structure from story entities
 * Supports nested timelines for scenes with events
 */

import {
  SceneEntity,
  EventEntity,
  EntityReference,
  TimelineItemModel
} from '@/types/storyEntities';
import { TemporalPoint, TemporalSpan } from '@/types/temporal';
import { ENTITY_COLORS } from '@/lib/types/entityTypes';

/**
 * Format a TemporalPoint for display (moved from TimeParser to avoid dependency)
 */
function formatTemporalPointDisplay(point: TemporalPoint, format: 'full' | 'short' = 'full'): string {
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

export interface TimelineBuilderOptions {
  showParticipants?: boolean;
  maxParticipantsDisplay?: number;
  includeMedia?: boolean;
  filterByImportance?: ('critical' | 'major' | 'minor' | 'background')[];
  sortOrder?: 'chronological' | 'reverse' | 'importance';
}

export class StoryTimelineBuilder {
  private scenes: SceneEntity[];
  private events: EventEntity[];
  private entities: Map<string, any>;
  private options: TimelineBuilderOptions;
  private referenceTimeCache = new Map<string, number>();

  constructor(
    scenes: SceneEntity[],
    events: EventEntity[],
    allEntities: any[],
    options: TimelineBuilderOptions = {}
  ) {
    this.scenes = scenes;
    this.events = events;
    this.entities = new Map(allEntities.map(e => [e.id, e]));
    this.options = {
      showParticipants: true,
      maxParticipantsDisplay: 3,
      includeMedia: true,
      sortOrder: 'chronological',
      ...options
    };

    // Build reference time cache for relative time resolution
    this.buildReferenceTimeCache();
  }

  /**
   * Build the complete timeline structure for react-chrono
   */
  build(): TimelineItemModel[] {
    // Sort scenes by temporal order
    const sortedScenes = this.sortByTime(this.scenes);

    return sortedScenes.map(scene => this.buildSceneItem(scene));
  }

  /**
   * Build timeline for standalone events (not part of scenes)
   */
  buildEventsOnly(): TimelineItemModel[] {
    // Filter events that don't have a parent scene
    const standaloneEvents = this.events.filter(e => !e.parentSceneId);

    // Apply importance filter if set
    const filtered = this.options.filterByImportance
      ? standaloneEvents.filter(e => this.options.filterByImportance!.includes(e.importance))
      : standaloneEvents;

    const sorted = this.sortByTime(filtered);
    return sorted.map(event => this.buildEventItem(event));
  }

  /**
   * Build a character-centric timeline
   */
  buildForCharacter(characterId: string): TimelineItemModel[] {
    // Find scenes/events where character participates
    const relevantScenes = this.scenes.filter(scene =>
      scene.participants.some(p => p.id === characterId) ||
      scene.povCharacterId === characterId
    );

    const relevantEvents = this.events.filter(event =>
      event.actors.some(a => a.id === characterId) ||
      event.affectedEntities.some(e => e.id === characterId)
    );

    // Build combined timeline
    const sceneItems = relevantScenes.map(s => this.buildSceneItem(s));
    const eventItems = relevantEvents
      .filter(e => !e.parentSceneId)
      .map(e => this.buildEventItem(e));

    return this.sortByTime([...sceneItems, ...eventItems] as any[]);
  }

  /**
   * Build timeline for a specific location
   */
  buildForLocation(location: string): TimelineItemModel[] {
    const relevantScenes = this.scenes.filter(scene =>
      scene.location?.toLowerCase().includes(location.toLowerCase())
    );

    return this.sortByTime(relevantScenes).map(s => this.buildSceneItem(s));
  }

  /**
   * Build a scene timeline item with nested events
   */
  private buildSceneItem(scene: SceneEntity): TimelineItemModel {
    const sceneEvents = scene.events ||
      this.events.filter(e => e.parentSceneId === scene.id);

    return {
      title: this.formatTimeDisplay(scene.temporal.start),
      cardTitle: scene.cardTitle || scene.label,
      cardSubtitle: this.generateSceneSubtitle(scene),
      cardDetailedText: this.enrichDescription(scene),
      media: this.options.includeMedia && scene.media ? {
        type: scene.media.type,
        source: { url: scene.media.url }
      } : undefined,
      // Nested timeline for events within the scene
      items: sceneEvents.length > 0
        ? this.buildEventTimeline(sceneEvents, scene)
        : undefined,
      entityId: scene.id,
      entityKind: 'SCENE'
    };
  }

  /**
   * Build a standalone event timeline item
   */
  private buildEventItem(event: EventEntity): TimelineItemModel {
    return {
      title: this.formatTimeDisplay(event.temporal.start, 'short'),
      cardTitle: event.cardTitle || event.label,
      cardSubtitle: this.getParticipantsSummary(event.actors),
      cardDetailedText: this.generateEventDescription(event),
      media: this.options.includeMedia && event.media ? {
        type: event.media.type,
        source: { url: event.media.url }
      } : undefined,
      items: event.subEvents && event.subEvents.length > 0
        ? this.buildEventTimeline(event.subEvents)
        : undefined,
      entityId: event.id,
      entityKind: 'EVENT'
    };
  }

  /**
   * Build nested event timeline for a scene
   */
  private buildEventTimeline(
    events: EventEntity[],
    parentScene?: SceneEntity
  ): TimelineItemModel[] {
    // Apply importance filter if set
    let filtered = this.options.filterByImportance
      ? events.filter(e => this.options.filterByImportance!.includes(e.importance))
      : events;

    const sorted = this.sortByTime(filtered);

    return sorted.map(event => ({
      title: this.formatTimeDisplay(event.temporal.start, 'short'),
      cardTitle: event.cardTitle || event.label,
      cardSubtitle: this.getParticipantsSummary(event.actors),
      cardDetailedText: this.generateEventDescription(event),
      media: this.options.includeMedia && event.media ? {
        type: event.media.type,
        source: { url: event.media.url }
      } : undefined,
      // Recursively handle sub-events
      items: event.subEvents && event.subEvents.length > 0
        ? this.buildEventTimeline(event.subEvents, parentScene)
        : undefined,
      entityId: event.id,
      entityKind: 'EVENT'
    }));
  }

  /**
   * Sort items by temporal order
   */
  private sortByTime<T extends { temporal: TemporalSpan }>(items: T[]): T[] {
    const sorted = [...items].sort((a, b) => {
      const timeA = this.getComparableTime(a.temporal.start);
      const timeB = this.getComparableTime(b.temporal.start);
      return this.options.sortOrder === 'reverse'
        ? timeB - timeA
        : timeA - timeB;
    });

    // Secondary sort by importance if specified
    if (this.options.sortOrder === 'importance') {
      const importanceOrder = { critical: 0, major: 1, minor: 2, background: 3 };
      return sorted.sort((a, b) => {
        const impA = (a as any).importance ? importanceOrder[(a as any).importance] : 99;
        const impB = (b as any).importance ? importanceOrder[(b as any).importance] : 99;
        return impA - impB;
      });
    }

    return sorted;
  }

  /**
   * Get a comparable numeric value for sorting temporal points
   */
  private getComparableTime(point: TemporalPoint): number {
    // Precise timestamps
    if (point.timestamp) {
      return point.timestamp.getTime();
    }

    // Sequential ordering (Chapter 1 Scene 2 = 1000002)
    if (point.granularity === 'sequential') {
      return (point.chapter || 0) * 1000000 +
        (point.act || 0) * 1000 +
        (point.sequence || 0);
    }

    // Relative times - resolve against reference points
    if (point.relativeToEventId && point.offsetDays !== undefined) {
      const refTime = this.resolveReferenceTime(point.relativeToEventId);
      const offsetMs = point.offsetDays * 86400000; // ms in a day
      const hourOffsetMs = (point.offsetHours || 0) * 3600000;
      return refTime + offsetMs + hourOffsetMs;
    }

    // Abstract times sort at the end
    return Number.MAX_SAFE_INTEGER;
  }

  /**
   * Resolve a reference event's timestamp
   */
  private resolveReferenceTime(eventId: string): number {
    if (this.referenceTimeCache.has(eventId)) {
      return this.referenceTimeCache.get(eventId)!;
    }

    // Look up the event
    const event = this.events.find(e => e.id === eventId);
    if (event?.temporal.start.timestamp) {
      const time = event.temporal.start.timestamp.getTime();
      this.referenceTimeCache.set(eventId, time);
      return time;
    }

    // Default to epoch if not found
    return 0;
  }

  /**
   * Build reference time cache for efficient lookup
   */
  private buildReferenceTimeCache(): void {
    [...this.scenes, ...this.events].forEach(item => {
      if (item.temporal.start.timestamp) {
        this.referenceTimeCache.set(item.id, item.temporal.start.timestamp.getTime());
      }
    });
  }

  /**
   * Format temporal point for display
   */
  private formatTimeDisplay(point: TemporalPoint, format: 'full' | 'short' = 'full'): string {
    return formatTemporalPointDisplay(point, format);
  }

  /**
   * Generate subtitle for a scene
   */
  private generateSceneSubtitle(scene: SceneEntity): string {
    const parts: string[] = [];

    // Location
    if (scene.location) {
      parts.push(scene.location);
    }

    // Participants
    if (this.options.showParticipants && scene.participants.length > 0) {
      const participants = scene.participants
        .slice(0, this.options.maxParticipantsDisplay)
        .map(p => this.entities.get(p.id)?.label || p.label || 'Unknown')
        .join(', ');

      const remaining = scene.participants.length - this.options.maxParticipantsDisplay!;
      parts.push(participants + (remaining > 0 ? ` +${remaining}` : ''));
    }

    // Mood
    if (scene.mood) {
      parts.push(`⬤ ${scene.mood}`);
    }

    return parts.join(' • ');
  }

  /**
   * Enrich scene description with participant details
   */
  private enrichDescription(scene: SceneEntity): string {
    let text = scene.description || '';

    if (this.options.showParticipants && scene.participants.length > 0) {
      const participantDetails = scene.participants.map(p => {
        const entity = this.entities.get(p.id);
        const label = entity?.label || p.label || 'Unknown';
        const role = p.role || entity?.kind || '';
        return `**${label}**${role ? ` (${role})` : ''}`;
      }).join(', ');

      if (participantDetails) {
        text += `\n\n*Present:* ${participantDetails}`;
      }
    }

    // Add POV character if set
    if (scene.povCharacterId) {
      const povChar = this.entities.get(scene.povCharacterId);
      if (povChar) {
        text += `\n\n*POV:* ${povChar.label}`;
      }
    }

    return text;
  }

  /**
   * Generate event description with context
   */
  private generateEventDescription(event: EventEntity): string {
    let text = event.description || '';

    // Add affected entities
    if (event.affectedEntities.length > 0) {
      const affected = event.affectedEntities
        .map(e => this.entities.get(e.id)?.label || e.label || 'Unknown')
        .join(', ');
      text += `\n\n*Affected:* ${affected}`;
    }

    // Add triggers/consequences
    if (event.triggers && event.triggers.length > 0) {
      text += `\n\n*Leads to:* ${event.triggers.length} event(s)`;
    }

    // Add tags
    if (event.tags.length > 0) {
      text += `\n\n*Tags:* ${event.tags.join(', ')}`;
    }

    return text;
  }

  /**
   * Get summary of participants/actors
   */
  private getParticipantsSummary(actors: EntityReference[]): string {
    return actors
      .slice(0, 2)
      .map(a => this.entities.get(a.id)?.label || a.label || 'Unknown')
      .join(' & ');
  }
}

/**
 * Factory function for quick timeline building
 */
export function buildStoryTimeline(
  scenes: SceneEntity[],
  events: EventEntity[],
  entities: any[],
  options?: TimelineBuilderOptions
): TimelineItemModel[] {
  const builder = new StoryTimelineBuilder(scenes, events, entities, options);
  return builder.build();
}
