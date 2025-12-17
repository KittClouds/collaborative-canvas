/**
 * Narrative Entity Types for Story Structure
 * These entities power the timeline and story organization features.
 */

import type { EntityKind, NarrativeEntityKind } from '@/lib/entities/entityTypes';
import type { TemporalPoint, TemporalSpan, TimeOfDay, DurationUnit } from './temporal';

/**
 * Base properties shared by all narrative entities
 */
export interface NarrativeEntityBase {
    id: string;
    kind: NarrativeEntityKind;
    label: string;
    sourceNoteId: string;

    // Temporal data
    temporal?: {
        type: 'point' | 'span';
        start: TemporalPoint;
        end?: TemporalPoint;
        duration?: {
            value: number;
            unit: DurationUnit;
        };
        confidence: number;
        source: 'parsed' | 'manual' | 'inferred';
        locked: boolean;
    };

    // Entity connections
    linkedEntityIds: string[];

    // Ordering
    sequence: number;
}

/**
 * Entity status for narrative entities
 */
export type NarrativeStatus = 'planning' | 'drafting' | 'complete' | 'revision';

/**
 * Stakes level for narrative tension
 */
export type StakesLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Arc Entity - Highest-level narrative structure
 * Represents major story movements (e.g., "The Investigation Arc", "Act I: Setup")
 */
export interface ArcEntity extends NarrativeEntityBase {
    kind: 'ARC';

    // Hierarchy
    parentArcId?: string;
    childActIds: string[];
    childChapterIds?: string[];
    childSceneIds?: string[];

    // Narrative metadata
    narrativeMetadata: {
        purpose?: string;
        theme?: string;
        protagonistId?: string;
        antagonistForce?: string;
        status: NarrativeStatus;
    };
}

/**
 * Act Entity - Major structural division
 * Interchangeable with Arc based on user's story model
 */
export interface ActEntity extends NarrativeEntityBase {
    kind: 'ACT';

    // Hierarchy
    parentArcId?: string;
    childChapterIds: string[];
    childSceneIds?: string[];
    siblingActIds?: string[];

    // Narrative metadata
    narrativeMetadata: {
        structureType?: 'three-act' | 'five-act' | 'heros-journey' | 'save-the-cat' | 'custom';
        purpose?: string;
        keyTurningPoint?: string;
        stakes?: StakesLevel;
        emotionalTone?: string;
        status: NarrativeStatus;
    };
}

/**
 * Chapter Entity - Story subdivision within acts
 * Optional—some stories don't use chapters
 */
export interface ChapterEntity extends NarrativeEntityBase {
    kind: 'CHAPTER';

    // Hierarchy
    parentActId?: string;
    parentArcId?: string;
    childSceneIds: string[];

    // Narrative metadata
    narrativeMetadata: {
        chapterNumber?: number;
        povCharacterId?: string;
        location?: string;
        summary?: string;
        wordCount?: number;
        targetWordCount?: number;
        status: NarrativeStatus;
    };
}

/**
 * Scene Entity - Fundamental narrative unit
 * Continuous action in one place/time with specific participants
 */
export interface SceneEntity extends NarrativeEntityBase {
    kind: 'SCENE';

    // Hierarchy
    parentChapterId?: string;
    parentActId?: string;
    parentArcId?: string;
    childBeatIds: string[];
    childEventIds: string[];

    // Temporal details
    temporalDetails?: {
        timeOfDay?: TimeOfDay;
        duration?: {
            value: number;
            unit: 'minutes' | 'hours' | 'days';
        };
    };

    // Scene-specific metadata
    sceneMetadata: {
        location: string;
        secondaryLocations?: string[];
        povCharacterId?: string;
        participants: string[];
        purpose: 'setup' | 'conflict' | 'revelation' | 'transition' | 'climax' | 'resolution';
        conflict?: string;
        stakes?: StakesLevel;
        emotionalTone?: string;
        sensoryDetails?: string;
        weatherMood?: string;
        status: NarrativeStatus;
    };

    // Writing metadata
    writingMetadata?: {
        wordCount?: number;
        targetWordCount?: number;
        draftVersion?: number;
        lastEditDate?: Date;
        notes?: string;
    };
}

/**
 * Beat Entity - Smallest narrative unit
 * A single story moment or action within a scene
 */
export interface BeatEntity extends NarrativeEntityBase {
    kind: 'BEAT';

    // Hierarchy - beats always belong to scenes
    parentSceneId: string;

    // Beat-specific metadata
    beatMetadata: {
        type: 'action' | 'dialogue' | 'description' | 'internal-thought' | 'revelation' | 'decision';
        actor?: string;
        target?: string;
        emotionalShift?: string;
        purpose?: string;
        emphasis?: 'major' | 'minor';
    };
}

/**
 * Event Entity - Standalone story occurrence
 * May or may not align with scene structure
 */
export interface EventEntity extends NarrativeEntityBase {
    kind: 'EVENT';

    // Hierarchy (flexible—events can stand alone or nest)
    parentSceneId?: string;
    parentEventId?: string;
    childEventIds?: string[];

    // Event-specific metadata
    eventMetadata: {
        type: 'plot' | 'historical' | 'personal' | 'world' | 'background';
        scope: 'personal' | 'local' | 'regional' | 'global' | 'cosmic';
        participants: string[];
        location?: string;
        causeEventId?: string;
        consequenceEventIds?: string[];
        impact: 'minor' | 'moderate' | 'major' | 'catastrophic';
        visibility: 'secret' | 'private' | 'public' | 'legendary';
        description?: string;
    };
}

/**
 * Timeline Entity - View configuration for narrative entities
 * Defines how to display timeline views
 */
export interface TimelineEntity extends NarrativeEntityBase {
    kind: 'TIMELINE';

    // Timeline configuration
    config: {
        scope: 'master' | 'arc' | 'act' | 'chapter' | 'character' | 'location' | 'custom';

        // Filter criteria
        filters: {
            entityKinds: NarrativeEntityKind[];
            entityIds?: string[];
            characterIds?: string[];
            locationIds?: string[];
            tags?: string[];
            dateRange?: {
                start: TemporalPoint;
                end: TemporalPoint;
            };
            arcId?: string;
            actId?: string;
        };

        // Display settings
        viewMode: 'cards' | 'calendar' | 'gantt' | 'narrative' | 'list';
        groupBy?: 'none' | 'arc' | 'act' | 'chapter' | 'location' | 'character' | 'date';
        sortBy: 'temporal' | 'manual' | 'narrative' | 'creation';

        // Manual ordering override
        manualOrdering?: string[];

        // Visual customization
        showEmptyPeriods?: boolean;
        collapseNested?: boolean;
        cardHeight?: number;
        nestedCardHeight?: number;
    };

    // Timeline metadata
    timelineMetadata: {
        description?: string;
        color?: string;
        icon?: string;
        isPrimary?: boolean;
        lastModified?: Date;
    };
}

/**
 * Narrative Timeline Root Entity
 * Root folder schema for a storybible/timeline
 */
export interface NarrativeTimelineEntity extends NarrativeEntityBase {
    kind: 'NARRATIVE';

    // Hierarchy
    childArcIds?: string[];
    childActIds?: string[];
    childChapterIds?: string[];
    childSceneIds?: string[];

    // Narrative metadata
    narrativeMetadata: {
        title: string;
        author?: string;
        logline?: string;
        premise?: string;
        theme?: string;
        status: NarrativeStatus;
    };
}

/**
 * Union type for all narrative entities
 */
export type NarrativeEntity =
    | ArcEntity
    | ActEntity
    | ChapterEntity
    | SceneEntity
    | BeatEntity
    | EventEntity
    | TimelineEntity
    | NarrativeTimelineEntity;

/**
 * Narrative hierarchy relationship rules
 */
export const NARRATIVE_HIERARCHY: Record<NarrativeEntityKind, {
    canHaveParent: NarrativeEntityKind[];
    canHaveChildren: NarrativeEntityKind[];
    defaultChildType: NarrativeEntityKind | null;
}> = {
    NARRATIVE: {
        canHaveParent: [],
        canHaveChildren: ['ARC', 'ACT', 'CHAPTER', 'SCENE', 'EVENT'],
        defaultChildType: 'ARC',
    },
    ARC: {
        canHaveParent: ['NARRATIVE', 'ARC'],
        canHaveChildren: ['ACT', 'CHAPTER', 'SCENE'],
        defaultChildType: 'ACT',
    },
    ACT: {
        canHaveParent: ['NARRATIVE', 'ARC'],
        canHaveChildren: ['CHAPTER', 'SCENE'],
        defaultChildType: 'CHAPTER',
    },
    CHAPTER: {
        canHaveParent: ['NARRATIVE', 'ACT', 'ARC'],
        canHaveChildren: ['SCENE'],
        defaultChildType: 'SCENE',
    },
    SCENE: {
        canHaveParent: ['NARRATIVE', 'CHAPTER', 'ACT', 'ARC'],
        canHaveChildren: ['BEAT', 'EVENT'],
        defaultChildType: 'BEAT',
    },
    BEAT: {
        canHaveParent: ['SCENE'],
        canHaveChildren: [],
        defaultChildType: null,
    },
    EVENT: {
        canHaveParent: ['NARRATIVE', 'SCENE', 'EVENT'],
        canHaveChildren: ['EVENT'],
        defaultChildType: 'EVENT',
    },
    TIMELINE: {
        canHaveParent: [],
        canHaveChildren: [],
        defaultChildType: null,
    },
};

/**
 * Entity linking rules
 */
export const ENTITY_LINK_RULES: Record<NarrativeEntityKind, {
    canLinkTo: EntityKind[] | 'all';
    requiredLinks?: EntityKind[];
    suggestedLinks?: EntityKind[];
}> = {
    NARRATIVE: { canLinkTo: 'all' },
    ARC: { canLinkTo: 'all' },
    ACT: { canLinkTo: 'all' },
    CHAPTER: { canLinkTo: 'all' },
    SCENE: {
        canLinkTo: ['CHARACTER', 'LOCATION', 'NPC', 'ITEM', 'FACTION', 'CONCEPT', 'EVENT'],
        requiredLinks: ['LOCATION'],
        suggestedLinks: ['CHARACTER'],
    },
    BEAT: { canLinkTo: 'all' },
    EVENT: {
        canLinkTo: ['CHARACTER', 'LOCATION', 'NPC', 'ITEM', 'FACTION', 'CONCEPT', 'SCENE'],
        suggestedLinks: ['CHARACTER', 'LOCATION'],
    },
    TIMELINE: {
        canLinkTo: ['ARC', 'ACT', 'CHAPTER', 'SCENE', 'BEAT', 'EVENT'],
    },
};

/**
 * Helper to create a default narrative entity
 */
export function createDefaultNarrativeEntity(
    kind: NarrativeEntityKind,
    label: string,
    sourceNoteId: string
): Partial<NarrativeEntity> {
    const base: NarrativeEntityBase = {
        id: crypto.randomUUID(),
        kind,
        label,
        sourceNoteId,
        linkedEntityIds: [],
        sequence: 0,
    };

    switch (kind) {
        case 'NARRATIVE':
            return {
                ...base,
                kind: 'NARRATIVE',
                narrativeMetadata: {
                    title: label,
                    status: 'planning',
                },
            } as NarrativeTimelineEntity;
        case 'ARC':
            return {
                ...base,
                kind: 'ARC',
                childActIds: [],
                narrativeMetadata: { status: 'planning' },
            } as ArcEntity;
        case 'ACT':
            return {
                ...base,
                kind: 'ACT',
                childChapterIds: [],
                narrativeMetadata: { status: 'planning' },
            } as ActEntity;
        case 'CHAPTER':
            return {
                ...base,
                kind: 'CHAPTER',
                childSceneIds: [],
                narrativeMetadata: { status: 'planning' },
            } as ChapterEntity;
        case 'SCENE':
            return {
                ...base,
                kind: 'SCENE',
                childBeatIds: [],
                childEventIds: [],
                sceneMetadata: {
                    location: '',
                    participants: [],
                    purpose: 'setup',
                    status: 'planning',
                },
            } as SceneEntity;
        case 'BEAT':
            return {
                ...base,
                kind: 'BEAT',
                parentSceneId: '',
                beatMetadata: { type: 'action' },
            } as BeatEntity;
        case 'EVENT':
            return {
                ...base,
                kind: 'EVENT',
                eventMetadata: {
                    type: 'plot',
                    scope: 'local',
                    participants: [],
                    impact: 'minor',
                    visibility: 'public',
                },
            } as EventEntity;
        case 'TIMELINE':
            return {
                ...base,
                kind: 'TIMELINE',
                config: {
                    scope: 'master',
                    filters: { entityKinds: ['SCENE', 'EVENT'] },
                    viewMode: 'cards',
                    sortBy: 'temporal',
                },
                timelineMetadata: { isPrimary: false },
            } as TimelineEntity;
        default:
            return base;
    }
}
