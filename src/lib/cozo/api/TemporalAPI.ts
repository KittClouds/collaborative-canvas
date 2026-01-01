/**
 * Temporal API
 * 
 * High-level API for querying temporal mentions from CozoDB.
 * Designed for UI consumption with rich context data.
 */

import { cozoDb } from '../db';
import { TEMPORAL_MENTION_QUERIES } from '../schema/layer2-temporal-mentions';
// Temporal kind type (matches Rust TemporalKind)
type TemporalKind = 'NARRATIVE_MARKER' | 'RELATIVE' | 'CONNECTOR' | 'WEEKDAY' | 'MONTH' | 'TIME_OF_DAY' | 'ERA';

// ==================== TYPES ====================

export interface TemporalMentionResult {
    id: string;
    noteId: string;
    noteTitle?: string;
    kind: TemporalKind;
    text: string;
    position: { start: number; end: number };
    contextSentence: string;
    contextParagraph?: string;
    confidence: number;
    metadata: {
        weekdayIndex?: number;
        monthIndex?: number;
        narrativeNumber?: number;
        direction?: string;
        eraName?: string;
        eraYear?: number;
    };
}

export interface TemporalKindCount {
    kind: TemporalKind;
    count: number;
}

// ==================== API METHODS ====================

/**
 * Get all temporal mentions for a specific note.
 */
export function getTemporalMentionsByNote(noteId: string): TemporalMentionResult[] {
    if (!cozoDb.isReady()) return [];

    try {
        const result = cozoDb.runQuery(TEMPORAL_MENTION_QUERIES.getByNoteId, { note_id: noteId });

        if (!result.ok || !result.rows) return [];

        return result.rows.map((row: any[]) => ({
            id: row[0],
            noteId,
            kind: row[1] as TemporalKind,
            text: row[2],
            position: { start: row[3], end: row[4] },
            contextSentence: row[5],
            confidence: row[6],
            metadata: {
                weekdayIndex: row[7] ?? undefined,
                monthIndex: row[8] ?? undefined,
                narrativeNumber: row[9] ?? undefined,
                direction: row[10] ?? undefined,
                eraName: row[11] ?? undefined,
                eraYear: row[12] ?? undefined,
            },
        }));
    } catch (err) {
        console.error('[TemporalAPI] getTemporalMentionsByNote failed:', err);
        return [];
    }
}

/**
 * Get all temporal mentions of a specific kind across all notes.
 */
export function getTemporalMentionsByKind(kind: TemporalKind): TemporalMentionResult[] {
    if (!cozoDb.isReady()) return [];

    try {
        const result = cozoDb.runQuery(TEMPORAL_MENTION_QUERIES.getByKind, { kind });

        if (!result.ok || !result.rows) return [];

        return result.rows.map((row: any[]) => ({
            id: row[0],
            noteId: row[1],
            kind,
            text: row[2],
            position: { start: row[3], end: row[4] },
            contextSentence: row[5],
            confidence: row[6],
            metadata: {
                weekdayIndex: row[7] ?? undefined,
                monthIndex: row[8] ?? undefined,
                narrativeNumber: row[9] ?? undefined,
                direction: row[10] ?? undefined,
                eraName: row[11] ?? undefined,
                eraYear: row[12] ?? undefined,
            },
        }));
    } catch (err) {
        console.error('[TemporalAPI] getTemporalMentionsByKind failed:', err);
        return [];
    }
}

/**
 * Get all mentions of a specific era (e.g., "Third Age") sorted by year.
 */
export function getEraTimeline(eraName: string): TemporalMentionResult[] {
    if (!cozoDb.isReady()) return [];

    try {
        const result = cozoDb.runQuery(TEMPORAL_MENTION_QUERIES.getByEraName, { era_name: eraName.toLowerCase() });

        if (!result.ok || !result.rows) return [];

        return result.rows.map((row: any[]) => ({
            id: row[0],
            noteId: row[1],
            kind: 'ERA' as TemporalKind,
            text: row[2],
            position: { start: row[5], end: row[5] + row[2].length },
            contextSentence: row[4],
            confidence: 0.9,
            metadata: {
                eraName: eraName.toLowerCase(),
                eraYear: row[3] ?? undefined,
            },
        }));
    } catch (err) {
        console.error('[TemporalAPI] getEraTimeline failed:', err);
        return [];
    }
}

/**
 * Get temporal mentions with full context including note titles.
 */
export function getTemporalMentionsWithContext(): TemporalMentionResult[] {
    if (!cozoDb.isReady()) return [];

    try {
        const result = cozoDb.runQuery(TEMPORAL_MENTION_QUERIES.getWithContext, {});

        if (!result.ok || !result.rows) return [];

        return result.rows.map((row: any[]) => ({
            id: row[0],
            kind: row[1] as TemporalKind,
            text: row[2],
            contextSentence: row[3],
            contextParagraph: row[4] ?? undefined,
            noteTitle: row[5],
            noteId: row[6],
            position: { start: 0, end: 0 }, // Not available in this query
            confidence: 0.8,
            metadata: {},
        }));
    } catch (err) {
        console.error('[TemporalAPI] getTemporalMentionsWithContext failed:', err);
        return [];
    }
}

/**
 * Get counts of temporal mentions by kind.
 */
export function getTemporalKindCounts(): TemporalKindCount[] {
    if (!cozoDb.isReady()) return [];

    try {
        const result = cozoDb.runQuery(TEMPORAL_MENTION_QUERIES.countByKind, {});

        if (!result.ok || !result.rows) return [];

        return result.rows.map((row: any[]) => ({
            kind: row[0] as TemporalKind,
            count: row[1],
        }));
    } catch (err) {
        console.error('[TemporalAPI] getTemporalKindCounts failed:', err);
        return [];
    }
}

/**
 * Get all unique era names mentioned across notes.
 */
export function getUniqueEras(): string[] {
    const eraMentions = getTemporalMentionsByKind('ERA');
    const eraNames = new Set<string>();

    for (const mention of eraMentions) {
        if (mention.metadata.eraName) {
            eraNames.add(mention.metadata.eraName);
        }
    }

    return Array.from(eraNames).sort();
}

/**
 * Search temporal mentions by text content.
 */
export function searchTemporalMentions(query: string): TemporalMentionResult[] {
    // For now, use in-memory filtering
    // Could be optimized with a CozoDB contains() query later
    const allWithContext = getTemporalMentionsWithContext();
    const lowerQuery = query.toLowerCase();

    return allWithContext.filter(m =>
        m.text.toLowerCase().includes(lowerQuery) ||
        m.contextSentence.toLowerCase().includes(lowerQuery)
    );
}
