/**
 * Story entity types extending the base entity system for temporal storytelling
 */

import { EntityKind } from '@/lib/types/entityTypes';
import { TemporalSpan, MediaReference } from './temporal';

/**
 * Base properties shared by story entities
 */
export interface BaseStoryEntity {
  id: string;
  kind: EntityKind;
  label: string;
  subtype?: string;
  noteId?: string;
  attributes?: Record<string, any>;
}

/**
 * Reference to another entity with optional role
 */
export interface EntityReference {
  id: string;
  kind: string;
  label?: string;
  role?: string; // e.g., "protagonist", "witness", "victim"
}

/**
 * Importance level for narrative events
 */
export type EventImportance = 'critical' | 'major' | 'minor' | 'background';

/**
 * Scene entity - a temporal container for events
 */
export interface SceneEntity extends BaseStoryEntity {
  kind: 'SCENE';
  temporal: TemporalSpan;

  // Nested sub-events
  events: EventEntity[];

  // Participants (characters, locations)
  participants: EntityReference[];

  // Story context
  povCharacterId?: string;
  location?: string;
  mood?: string;

  // Timeline rendering
  cardTitle: string;
  cardSubtitle?: string;
  description?: string;
  media?: MediaReference;
}

/**
 * Event entity - something that happens within a scene
 */
export interface EventEntity extends BaseStoryEntity {
  kind: 'EVENT';
  temporal: TemporalSpan;

  // Event hierarchy
  parentSceneId?: string;
  subEvents?: EventEntity[];

  // Causal relationships
  triggeredBy?: string[];
  triggers?: string[];

  // Participants
  actors: EntityReference[];
  affectedEntities: EntityReference[];

  // Narrative significance
  importance: EventImportance;
  tags: string[];

  // Timeline rendering
  cardTitle?: string;
  description?: string;
  media?: MediaReference;
}

/**
 * Timeline item model compatible with react-chrono
 */
export interface TimelineItemModel {
  title?: string;
  cardTitle?: string;
  cardSubtitle?: string;
  cardDetailedText?: string | string[];
  media?: {
    type: 'IMAGE' | 'VIDEO';
    source: {
      url: string;
    };
  };
  items?: TimelineItemModel[];
  // Custom data
  entityId?: string;
  entityKind?: string;
}

/**
 * Timeline configuration options
 */
export interface TimelineConfig {
  mode: 'VERTICAL' | 'VERTICAL_ALTERNATING' | 'HORIZONTAL';
  cardHeight?: number;
  nestedCardHeight?: number;
  showAllCardsHorizontal?: boolean;
  enableOutline?: boolean;
  slideShow?: boolean;
}
