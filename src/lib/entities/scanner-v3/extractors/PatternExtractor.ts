/**
 * PatternExtractor - Unified pattern extraction using PatternRegistry
 * 
 * Replaces hardcoded regex with centralized pattern definitions.
 */
import { patternRegistry } from '@/lib/refs';
import type { PatternMatchEvent } from '../types';

/**
 * Extracts entities using PatternRegistry (no hardcoded regex)
 */
export class PatternExtractor {
    /**
     * Extract all pattern matches from text
     * (Used for batch scanning when needed)
     */
    extractFromText(text: string, noteId: string): PatternMatchEvent[] {
        const events: PatternMatchEvent[] = [];
        const patterns = patternRegistry.getActivePatterns();

        for (const pattern of patterns) {
            const regex = patternRegistry.getCompiledPattern(pattern.id);
            if (!regex) continue;

            regex.lastIndex = 0;

            let match: RegExpExecArray | null;
            while ((match = regex.exec(text)) !== null) {
                // Prevent infinite loop on zero-length matches
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }

                const fullMatch = match[0];
                const captures: Record<string, string> = {};

                // Extract captures based on pattern definition
                if (pattern.captures) {
                    for (const [key, mapping] of Object.entries(pattern.captures)) {
                        const value = match[mapping.group];
                        if (value) {
                            captures[key] = mapping.transform
                                ? mapping.transform(value, { noteId, fullText: text, position: match.index })
                                : value;
                        }
                    }
                }

                events.push({
                    kind: pattern.kind,
                    fullMatch,
                    position: match.index,
                    length: fullMatch.length,
                    captures,
                    patternId: pattern.id,
                    noteId,
                    timestamp: Date.now(),
                });
            }
        }

        // Resolve overlaps: higher priority patterns win
        return this.resolveOverlaps(events);
    }

    /**
     * Resolve overlapping matches - higher priority wins
     */
    private resolveOverlaps(events: PatternMatchEvent[]): PatternMatchEvent[] {
        if (events.length <= 1) return events;

        // Sort by position, then by pattern priority (descending)
        const sorted = [...events].sort((a, b) => {
            if (a.position !== b.position) return a.position - b.position;
            // Get priorities from registry
            const patternA = patternRegistry.getPattern(a.patternId);
            const patternB = patternRegistry.getPattern(b.patternId);
            return (patternB?.priority ?? 0) - (patternA?.priority ?? 0);
        });

        const resolved: PatternMatchEvent[] = [];
        let lastEnd = -1;

        for (const event of sorted) {
            const eventEnd = event.position + event.length;

            // Skip if this event overlaps with the last kept event
            if (event.position < lastEnd) {
                continue;
            }

            resolved.push(event);
            lastEnd = eventEnd;
        }

        return resolved;
    }

    /**
     * Extract only entity patterns
     */
    extractEntities(text: string, noteId: string): PatternMatchEvent[] {
        return this.extractFromText(text, noteId).filter(e => e.kind === 'entity');
    }

    /**
     * Extract only triple patterns (both full and inline)
     */
    extractTriples(text: string, noteId: string): PatternMatchEvent[] {
        return this.extractFromText(text, noteId).filter(e => e.kind === 'triple');
    }

    /**
     * Extract only wikilinks
     */
    extractWikilinks(text: string, noteId: string): PatternMatchEvent[] {
        return this.extractFromText(text, noteId).filter(e => e.kind === 'wikilink');
    }

    /**
     * Extract only tags
     */
    extractTags(text: string, noteId: string): PatternMatchEvent[] {
        return this.extractFromText(text, noteId).filter(e => e.kind === 'tag');
    }

    /**
     * Extract only mentions
     */
    extractMentions(text: string, noteId: string): PatternMatchEvent[] {
        return this.extractFromText(text, noteId).filter(e => e.kind === 'mention');
    }

    /**
     * Extract temporal patterns
     */
    extractTemporal(text: string, noteId: string): PatternMatchEvent[] {
        return this.extractFromText(text, noteId).filter(e => e.kind === 'temporal');
    }
}

export const patternExtractor = new PatternExtractor();
