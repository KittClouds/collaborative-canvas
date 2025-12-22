/**
 * Refs Module - Public API
 * 
 * Exports all types and utilities for the Ref system.
 */

// Core types
export type {
    Ref,
    RefKind,
    RefScope,
    RefPosition,
    EntityRefPayload,
    WikilinkRefPayload,
    BacklinkRefPayload,
    TagRefPayload,
    MentionRefPayload,
    TripleRefPayload,
    TemporalRefPayload,
    CustomRefPayload,
} from './types';

// Type guards
export {
    isEntityRef,
    isTripleRef,
    isWikilinkRef,
    isBacklinkRef,
    isTagRef,
    isMentionRef,
    isTemporalRef,
    isCustomRef,
} from './types';

// Pattern schema
export type {
    PatternDefinition,
    SerializablePatternDefinition,
    ParseContext,
    CaptureMapping,
    PatternRendering,
    PatternConstraints,
    ScopeRule,
    TransformFn,
    ValidatorFn,
} from './patterns/schema';

export {
    toSerializable,
    validatePatternSyntax,
} from './patterns/schema';

// Pattern registry
export {
    PatternRegistry,
    patternRegistry,
} from './patterns/registry';

// Default patterns
export {
    DEFAULT_PATTERNS,
    ENTITY_PATTERN,
    WIKILINK_PATTERN,
    BACKLINK_PATTERN,
    TAG_PATTERN,
    MENTION_PATTERN,
    TRIPLE_PATTERN,
    TEMPORAL_PATTERNS,
    getDefaultPatternsByKind,
    getDefaultPatternById,
} from './patterns/defaults';

// Parser
export {
    RefParser,
    refParser,
    parseRefs,
} from './parser';

// Constraints
export {
    RefConstraintEngine,
    refConstraintEngine,
    type ConstraintResult,
} from './constraints';

// Projections
export {
    RefProjector,
    refProjector,
    type TimelineEvent,
    type CharacterSheet,
    type CharacterRelationship,
    type NoteAppearance,
    type CharacterStats,
} from './projections';
