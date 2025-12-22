/**
 * Ref<T> - Universal Reference Type System
 * 
 * Unifies all link-like objects (entities, wikilinks, tags, etc.)
 * into a single, typed, extensible data structure.
 */

import type { EntityKind } from '../entities/entityTypes';

// ==================== CORE TYPES ====================

/**
 * Reference Kind - What TYPE of reference is this?
 */
export type RefKind =
    | 'entity'          // [CHARACTER|Jon]
    | 'wikilink'        // [[Page Title]]
    | 'backlink'        // <<Page Title>>
    | 'tag'             // #tagname
    | 'mention'         // @username
    | 'triple'          // [A|X] ->PRED-> [B|Y]
    | 'temporal'        // temporal expressions
    | 'custom';         // user-defined kinds

/**
 * Reference Scope - Where does it live?
 */
export interface RefScope {
    type: 'note' | 'folder' | 'vault' | 'workspace';
    path?: string;      // For hierarchical scopes
}

/**
 * Reference Position - Where does it appear in documents?
 */
export interface RefPosition {
    noteId: string;
    offset: number;     // Character position
    length: number;
    contextBefore: string;
    contextAfter: string;
}

/**
 * The Universal Reference Type
 */
export interface Ref<T = unknown> {
    // Core identity
    id: string;                    // UUID for this ref instance
    kind: RefKind;                 // What TYPE of reference is this?
    scope: RefScope;               // Where does it live?

    // Targeting
    target: string;                // Raw target string (e.g., "Jon", "Page Title")
    targetResolved?: string;       // Normalized/resolved target (entity ID, note ID, etc.)

    // Semantics
    predicate?: string;            // For triple refs: the relationship type
    attributes?: Record<string, unknown>; // Structured metadata

    // Provenance
    sourceNoteId: string;          // Where was this ref created?
    positions: RefPosition[];      // Where does it appear in documents?
    confidence?: number;           // For ML-suggested refs

    // Lifecycle
    createdAt: number;
    lastSeenAt: number;

    // Type-specific payload
    payload: T;
}

// ==================== PAYLOAD TYPES ====================

/**
 * Entity Reference Payload
 */
export interface EntityRefPayload {
    entityKind: EntityKind;
    subtype?: string;
    aliases?: string[];
}

/**
 * Triple Reference Payload
 */
export interface TripleRefPayload {
    subjectId: string;
    subjectKind: EntityKind;
    subjectLabel: string;
    objectId: string;
    objectKind: EntityKind;
    objectLabel: string;
}

/**
 * Wikilink Reference Payload
 */
export interface WikilinkRefPayload {
    exists: boolean;
    targetNoteId?: string;
    displayText?: string;
}

/**
 * Backlink Reference Payload
 */
export interface BacklinkRefPayload {
    targetNoteId?: string;
    displayText?: string;
}

/**
 * Tag Reference Payload
 */
export interface TagRefPayload {
    normalized: string;  // lowercase, trimmed
}

/**
 * Mention Reference Payload
 */
export interface MentionRefPayload {
    userId?: string;
    displayName?: string;
}

/**
 * Temporal Reference Payload
 */
export interface TemporalRefPayload {
    expression: string;
    parsedDate?: string;    // ISO date if parseable
    relative?: boolean;     // "tomorrow" vs "2024-01-01"
    type: 'absolute' | 'relative' | 'duration' | 'range';
}

/**
 * Custom Reference Payload
 */
export interface CustomRefPayload {
    patternId: string;
    capturedGroups: Record<string, string>;
}

// ==================== TYPE GUARDS ====================

export function isEntityRef(ref: Ref): ref is Ref<EntityRefPayload> {
    return ref.kind === 'entity';
}

export function isTripleRef(ref: Ref): ref is Ref<TripleRefPayload> {
    return ref.kind === 'triple';
}

export function isWikilinkRef(ref: Ref): ref is Ref<WikilinkRefPayload> {
    return ref.kind === 'wikilink';
}

export function isBacklinkRef(ref: Ref): ref is Ref<BacklinkRefPayload> {
    return ref.kind === 'backlink';
}

export function isTagRef(ref: Ref): ref is Ref<TagRefPayload> {
    return ref.kind === 'tag';
}

export function isMentionRef(ref: Ref): ref is Ref<MentionRefPayload> {
    return ref.kind === 'mention';
}

export function isTemporalRef(ref: Ref): ref is Ref<TemporalRefPayload> {
    return ref.kind === 'temporal';
}

export function isCustomRef(ref: Ref): ref is Ref<CustomRefPayload> {
    return ref.kind === 'custom';
}
