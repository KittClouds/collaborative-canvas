/**
 * Temporal Mention Persistence
 * 
 * Subscribes to scanner temporal:detected events and persists to CozoDB.
 * Extracts sentence context for each mention for UI consumption.
 */

import { scannerEventBus } from '../core/ScannerEventBus';
import type { TemporalMention, TemporalKind } from '../extractors/TemporalAhoMatcher';
import { cozoDb } from '@/lib/cozo/db';
import { TEMPORAL_MENTION_QUERIES, type TemporalMentionRow } from '@/lib/cozo/schema/layer2-temporal-mentions';
import { generateId } from '@/lib/utils/ids';

// ==================== TYPES ====================

interface TemporalDetectedEvent {
    noteId: string;
    mentions: TemporalMention[];
    timestamp: number;
    fullText?: string; // Optional: full text for context extraction
}

interface PersistenceResult {
    added: number;
    failed: number;
    durationMs: number;
}

// ==================== CONTEXT EXTRACTION ====================

/**
 * Extract sentence containing a position from text.
 * Falls back to surrounding 100 chars if no sentence boundaries found.
 */
function extractSentenceContext(text: string, start: number, end: number): string {
    // Simple sentence boundary detection
    const sentenceEnders = /[.!?]/g;

    // Find sentence start (previous sentence ender + 1)
    let sentenceStart = 0;
    let match;
    while ((match = sentenceEnders.exec(text)) !== null) {
        if (match.index >= start) break;
        sentenceStart = match.index + 1;
    }

    // Find sentence end (next sentence ender)
    sentenceEnders.lastIndex = end;
    const nextEnd = sentenceEnders.exec(text);
    const sentenceEnd = nextEnd ? nextEnd.index + 1 : Math.min(end + 100, text.length);

    // Extract and trim
    const sentence = text.slice(sentenceStart, sentenceEnd).trim();

    // If too long (>300 chars), truncate around the mention
    if (sentence.length > 300) {
        const mentionCenter = (start + end) / 2 - sentenceStart;
        const contextStart = Math.max(0, mentionCenter - 150);
        const contextEnd = Math.min(sentence.length, mentionCenter + 150);
        return '...' + sentence.slice(contextStart, contextEnd).trim() + '...';
    }

    return sentence;
}

/**
 * Extract paragraph containing a position from text.
 */
function extractParagraphContext(text: string, start: number): string | undefined {
    const paragraphs = text.split(/\n\n+/);
    let currentPos = 0;

    for (const para of paragraphs) {
        const paraEnd = currentPos + para.length;
        if (start >= currentPos && start <= paraEnd) {
            // Limit to 500 chars
            return para.length > 500 ? para.slice(0, 500) + '...' : para;
        }
        currentPos = paraEnd + 2; // Account for \n\n
    }

    return undefined;
}

// ==================== PERSISTENCE ====================

/**
 * Persist temporal mentions to CozoDB.
 */
async function persistTemporalMentions(
    noteId: string,
    mentions: TemporalMention[],
    fullText: string,
    episodeId?: string
): Promise<PersistenceResult> {
    const start = performance.now();
    let added = 0;
    let failed = 0;

    if (!cozoDb.isReady()) {
        console.warn('[TemporalPersist] CozoDB not ready, skipping persistence');
        return { added: 0, failed: mentions.length, durationMs: 0 };
    }

    // Build batch of rows
    const rows: any[][] = [];

    for (const mention of mentions) {
        try {
            const id = generateId();
            const contextSentence = extractSentenceContext(fullText, mention.start, mention.end);
            const contextParagraph = extractParagraphContext(fullText, mention.start);
            const createdAt = Date.now() / 1000; // Unix timestamp in seconds

            rows.push([
                id,
                episodeId || null,
                noteId,
                mention.kind,
                mention.text,
                mention.start,
                mention.end,
                contextSentence,
                contextParagraph || null,
                mention.confidence,
                mention.metadata?.weekdayIndex ?? null,
                mention.metadata?.monthIndex ?? null,
                mention.metadata?.narrativeNumber ?? null,
                mention.metadata?.direction ?? null,
                mention.metadata?.eraName ?? null,
                mention.metadata?.eraYear ?? null,
                createdAt,
            ]);
        } catch (err) {
            console.error('[TemporalPersist] Failed to prepare mention:', err);
            failed++;
        }
    }

    // Batch insert
    if (rows.length > 0) {
        try {
            const result = cozoDb.runQuery(TEMPORAL_MENTION_QUERIES.upsertBatch, { rows });
            if (result.ok) {
                added = rows.length;
            } else {
                console.error('[TemporalPersist] Batch insert failed:', result);
                failed += rows.length;
            }
        } catch (err) {
            console.error('[TemporalPersist] Batch insert error:', err);
            failed += rows.length;
        }
    }

    const durationMs = performance.now() - start;

    if (added > 0) {
        console.log(`[TemporalPersist] Persisted ${added} mentions in ${durationMs.toFixed(1)}ms`);
    }

    return { added, failed, durationMs };
}

/**
 * Delete all temporal mentions for a note (before re-scan).
 */
async function clearTemporalMentions(noteId: string): Promise<void> {
    if (!cozoDb.isReady()) return;

    try {
        cozoDb.runQuery(TEMPORAL_MENTION_QUERIES.deleteByNoteId, { note_id: noteId });
    } catch (err) {
        console.error('[TemporalPersist] Failed to clear mentions:', err);
    }
}

// ==================== EVENT HANDLER ====================

let isInitialized = false;

/**
 * Initialize temporal persistence by subscribing to scanner events.
 */
export function initializeTemporalPersistence(): void {
    if (isInitialized) return;

    scannerEventBus.on('temporal:detected', async (event: TemporalDetectedEvent) => {
        const { noteId, mentions, fullText } = event;

        if (!mentions || mentions.length === 0) return;
        if (!fullText) {
            console.warn('[TemporalPersist] No fullText provided, skipping context extraction');
            return;
        }

        // Clear existing mentions for this note before persisting new ones
        await clearTemporalMentions(noteId);

        // Persist new mentions
        await persistTemporalMentions(noteId, mentions, fullText);
    });

    isInitialized = true;
    console.log('[TemporalPersist] Initialized temporal mention persistence');
}

/**
 * Check if persistence is initialized.
 */
export function isTemporalPersistenceInitialized(): boolean {
    return isInitialized;
}

// Export for direct use
export { persistTemporalMentions, clearTemporalMentions };
