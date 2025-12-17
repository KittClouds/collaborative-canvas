/**
 * Narrative Entity Templates
 * Default templates for each narrative entity type
 */

export const ARC_TEMPLATE = `# Overview
Brief description of this arc's purpose and scope.

## Temporal Span
**Start**: [Date or "Beginning of story"]
**End**: [Date or "Ongoing"]

## Narrative Purpose
What role does this arc play in the overall story?

## Key Characters
- [CHARACTER|Name] - Role in this arc

## Key Locations
- [LOCATION|Name]

## Acts/Subdivisions
- [ACT|Act Name]

## Themes
Central themes explored in this arc.

## Status
- [ ] Planning
- [ ] Outlining
- [ ] Drafting
- [ ] Complete
- [ ] Revision

## Notes
Additional thoughts about this arc.
`;

export const ACT_TEMPLATE = `# Overview
Purpose and scope of this act.

## Temporal Span
**Start**: [Date or sequence]
**End**: [Date or sequence]

## Structure Type
- [ ] Three-Act Structure
- [ ] Five-Act Structure
- [ ] Hero's Journey
- [ ] Save the Cat
- [ ] Custom

## Act Purpose
What structural role does this act serve? (Setup, Confrontation, Resolution, etc.)

## Key Turning Point
Major plot point or climax in this act.

## Chapters
- [CHAPTER|Chapter Name]

## Scenes (if no chapters)
- [SCENE|Scene Name]

## Stakes Level
- [ ] Low
- [ ] Medium
- [ ] High
- [ ] Critical

## Emotional Tone
Describe the overall mood/feeling of this act.

## Status
- [ ] Planning
- [ ] Drafting
- [ ] Complete
- [ ] Revision

## Notes
`;

export const CHAPTER_TEMPLATE = `# Chapter Details

## Chapter Number
[Number]

## Overview
Brief summary of what happens in this chapter.

## Temporal Span
**Start**: [Date/time]
**End**: [Date/time]

## POV Character
[CHARACTER|Name]

## Primary Location
[LOCATION|Name]

## Scenes
- [SCENE|Scene Name]

## Word Count
**Current**: 0
**Target**: ~3000

## Status
- [ ] Planning
- [ ] Drafting
- [ ] Complete
- [ ] Revision

## Notes
`;

export const SCENE_TEMPLATE = `# When
**Date/Time**: [January 20, 1949, Morning]
**Duration**: [~2 hours]
**Time of Day**: Morning / Afternoon / Evening / Night

# Where
**Primary Location**: [LOCATION|Name]
**Secondary Locations**: 

# Who
**POV Character**: [CHARACTER|Name]
**Participants**:
- [CHARACTER|Name]

# Purpose
What does this scene accomplish?
- [ ] Setup
- [ ] Conflict
- [ ] Revelation
- [ ] Transition
- [ ] Climax
- [ ] Resolution

# Conflict
What's the central tension or conflict in this scene?

# Stakes
- [ ] Low
- [ ] Medium
- [ ] High
- [ ] Critical

# Emotional Tone
[Tense, hopeful, dark, romantic, etc.]

# Summary
Brief summary of what happens.

# Beats
- [BEAT|Beat description]

# Events
- [EVENT|Event name] (if major event occurs in this scene)

# Sensory Details
Notes on atmosphere, weather, mood, sensory information.

---

## Scene Text
[Write your scene here...]

---

## Word Count
**Current**: 0
**Target**: ~1000

## Status
- [ ] Planning
- [ ] Drafting
- [ ] Complete
- [ ] Revision

## Writer's Notes
Additional notes to self about this scene.
`;

export const BEAT_TEMPLATE = `# Type
- [ ] Action
- [ ] Dialogue
- [ ] Description
- [ ] Internal Thought
- [ ] Revelation
- [ ] Decision

## When
**Timestamp**: [Precise moment or "Mid-scene"]

## Parent Scene
[SCENE|Scene Name]

## Actor
**Who performs this action**: [CHARACTER|Name]

## Target
**Who receives this action** (if applicable): [CHARACTER|Name]

## What Happens
Brief description of this story moment.

## Emotional Shift
How do emotions change in this beat?

## Purpose
Why is this beat important?

## Emphasis
- [ ] Major (critical beat)
- [ ] Minor (supporting beat)

## Notes
`;

export const EVENT_TEMPLATE = `# Event Type
- [ ] Plot Event
- [ ] Historical Event
- [ ] Personal Event
- [ ] World Event
- [ ] Background Event

## When
**Date/Time**: [January 14, 1949]
**Duration**: [Instantaneous / 2 hours / 3 days / etc.]

## Where
**Location**: [LOCATION|Name]

## Who (Participants)
- [CHARACTER|Name]

## Scope
- [ ] Personal (affects one person)
- [ ] Local (affects neighborhood/building)
- [ ] Regional (affects city/region)
- [ ] Global (affects world)
- [ ] Cosmic (affects reality itself)

## Visibility
- [ ] Secret (nobody knows)
- [ ] Private (few know)
- [ ] Public (widely known)
- [ ] Legendary (mythic status)

## Description
What happened?

## Cause
**Triggered by**: [EVENT|Previous Event] (if applicable)

## Consequences
**This event triggers**:
- [EVENT|Consequence Event]

## Impact Level
- [ ] Minor
- [ ] Moderate
- [ ] Major
- [ ] Catastrophic

## Related Scenes
- [SCENE|Scene where this is discovered]
- [SCENE|Scene where this occurs]

## Notes
`;

export const TIMELINE_TEMPLATE = `# Timeline Configuration

## Scope
- [ ] Master Timeline (entire story)
- [ ] Arc Timeline
- [ ] Act Timeline
- [ ] Chapter Timeline
- [ ] Character Arc Timeline
- [ ] Location Timeline
- [ ] Custom

## Description
What does this timeline represent?

## Filters
**Include Entity Types**:
- [x] Scenes
- [x] Events
- [ ] Arcs
- [ ] Acts
- [ ] Chapters
- [ ] Beats

**Filter by Character**: [CHARACTER|Name] (optional)
**Filter by Location**: [LOCATION|Name] (optional)
**Filter by Arc/Act**: [ARC|Name] or [ACT|Name] (optional)
**Date Range**: [Start] to [End] (optional)

## Display Settings
**View Mode**:
- [x] Cards (vertical nested timeline)
- [ ] Calendar (date grid)
- [ ] Gantt (duration bars)
- [ ] Narrative (hierarchical tree)
- [ ] List (simple list)

**Group By**:
- [x] None
- [ ] Arc
- [ ] Act
- [ ] Chapter
- [ ] Location
- [ ] Character
- [ ] Date

**Sort By**:
- [x] Temporal (by time)
- [ ] Manual (custom order)
- [ ] Narrative (by story structure)

## Visual Settings
- **Card Height**: 300px
- **Nested Card Height**: 220px
- **Show Empty Periods**: Yes
- **Collapse Nested**: No

## Notes
Additional information about this timeline.

---

*Timeline view will render when you open this note in Timeline View mode.*
`;

export const NARRATIVE_TEMPLATE = `# Story Bible: [Title]

## Overview
**Title**: [Working Title]
**Author**: [Author Name]
**Genre**: [Genre]
**Logline**: [One sentence summary]

## Premise
What if... (The core question or hook)

## Theme
Central message or argument of the story.

## Narrative Structure
- [ARC|Main Arc]
- [ACT|Act I]
- [ACT|Act II]
- [ACT|Act III]

## Key Characters
- [CHARACTER|Protagonist]
- [CHARACTER|Antagonist]

## Status
- [ ] Brainstorming
- [ ] Outlining
- [ ] Drafting
- [ ] Revision
- [ ] Polishing

## Notes
`;

/**
 * Get template for a given narrative entity kind
 */
export function getTemplateForKind(kind: string): string {
    switch (kind) {
        case 'NARRATIVE':
            return NARRATIVE_TEMPLATE;
        case 'ARC':
            return ARC_TEMPLATE;
        case 'ACT':
            return ACT_TEMPLATE;
        case 'CHAPTER':
            return CHAPTER_TEMPLATE;
        case 'SCENE':
            return SCENE_TEMPLATE;
        case 'BEAT':
            return BEAT_TEMPLATE;
        case 'EVENT':
            return EVENT_TEMPLATE;
        case 'TIMELINE':
            return TIMELINE_TEMPLATE;
        default:
            return '';
    }
}

/**
 * Folder configuration for narrative entity types
 */
export const NARRATIVE_FOLDER_CONFIGS: Record<string, {
    icon: string;
    color: string;
    autoPrefix: string;
    template: string;
}> = {
    NARRATIVE: {
        icon: '📚',
        color: '#4f46e5',
        autoPrefix: '[NARRATIVE|',
        template: NARRATIVE_TEMPLATE,
    },
    ARC: {
        icon: '🌊',
        color: '#a855f7',
        autoPrefix: '[ARC|',
        template: ARC_TEMPLATE,
    },
    ACT: {
        icon: '🎭',
        color: '#2563eb',
        autoPrefix: '[ACT|',
        template: ACT_TEMPLATE,
    },
    CHAPTER: {
        icon: '📖',
        color: '#14b8a6',
        autoPrefix: '[CHAPTER|',
        template: CHAPTER_TEMPLATE,
    },
    SCENE: {
        icon: '🎬',
        color: '#ec4899',
        autoPrefix: '[SCENE|',
        template: SCENE_TEMPLATE,
    },
    BEAT: {
        icon: '⚡',
        color: '#f97316',
        autoPrefix: '[BEAT|',
        template: BEAT_TEMPLATE,
    },
    EVENT: {
        icon: '📅',
        color: '#06b6d4',
        autoPrefix: '[EVENT|',
        template: EVENT_TEMPLATE,
    },
    TIMELINE: {
        icon: '⏳',
        color: '#eab308',
        autoPrefix: '[TIMELINE|',
        template: TIMELINE_TEMPLATE,
    },
    // Also include standard entity folders for consistency
    CHARACTER: {
        icon: '👤',
        color: '#8b5cf6',
        autoPrefix: '[CHARACTER|',
        template: '',
    },
    LOCATION: {
        icon: '📍',
        color: '#3b82f6',
        autoPrefix: '[LOCATION|',
        template: '',
    },
    NPC: {
        icon: '🧑‍🤝‍🧑',
        color: '#f59e0b',
        autoPrefix: '[NPC|',
        template: '',
    },
    ITEM: {
        icon: '🎒',
        color: '#10b981',
        autoPrefix: '[ITEM|',
        template: '',
    },
    FACTION: {
        icon: '⚔️',
        color: '#ef4444',
        autoPrefix: '[FACTION|',
        template: '',
    },
    CONCEPT: {
        icon: '💡',
        color: '#6366f1',
        autoPrefix: '[CONCEPT|',
        template: '',
    },
};
