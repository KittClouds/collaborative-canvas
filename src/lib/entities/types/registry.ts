// Core entity representation in registry
import type { EntityKind } from '../entityTypes';

interface RegisteredEntity {
    id: string;                    // UUIDv7
    label: string;                 // Canonical name
    normalizedLabel: string;       // Lowercase for matching
    kind: EntityKind;              // From existing entityTypes
    subtype?: string;
    aliases?: string[];

    // Provenance
    firstMentionNoteId: string;
    firstMentionDate: Date;
    createdBy: 'user' | 'extraction' | 'import';

    // Metadata
    metadata?: Record<string, any>;
    attributes?: Record<string, any>;

    // Statistics
    mentionsByNote: Map<string, number>; // noteId -> mention count
    totalMentions: number;            // Total across all notes
    lastSeenDate: Date;
    noteAppearances: Set<string>;
}

// Entity with position info (from parser)
interface ParsedEntity {
    type: 'explicit';
    kind: EntityKind;
    label: string;
    subtype?: string;
    metadata?: Record<string, any>;
    position: { start: number; end: number };
    context: string;              // Surrounding text
}

// Relationship between entities
interface EntityRelationship {
    id: string;                    // UUIDv7
    sourceEntityId: string;
    targetEntityId: string;
    type: string;                  // 'ally_of', 'enemy_of', etc.
    confidence: number;
    discoveredIn: string[];        // Note IDs where found
    contexts: string[];            // Text snippets showing relationship
}

// Co-occurrence pattern
interface CoOccurrencePattern {
    entities: string[];            // Entity IDs
    frequency: number;
    contexts: string[];
    strength: number;              // 0-1
}

// Result from document scanning
interface ScanResult {
    explicitEntities: ParsedEntity[];
    registeredEntities: RegisteredEntity[];
    matchedEntities: Array<{
        entity: RegisteredEntity;
        positions: number[];
    }>;
    relationships: EntityRelationship[];
    coOccurrences: CoOccurrencePattern[];
    winkAnalysis?: any;           // Shared analysis state for relationship extraction
    entityMentions?: any[];       // ResoRank-identified entity mentions
    stats?: any;                  // Extraction statistics
}

export type {
    RegisteredEntity,
    ParsedEntity,
    EntityRelationship,
    CoOccurrencePattern,
    ScanResult,
};
