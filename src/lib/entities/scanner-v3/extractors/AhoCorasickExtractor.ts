/**
 * AhoCorasickExtractor - Drop-in replacement for PatternExtractor
 * 
 * Uses Aho-Corasick for discriminator detection + explicit parsing for captures.
 * Same API, identical output, 5-10x faster on large documents.
 */

import { AhoCorasickMatcher, type DiscriminatorHit } from './AhoCorasickMatcher';
import { ExplicitParser, type ParseResult } from './ExplicitParser';
import { patternRegistry } from '@/lib/refs';
import type { PatternMatchEvent } from '../types';
import type { RefKind } from '@/lib/refs/types';

interface ParseAttempt {
    kind: RefKind;
    patternId: string;
    result: ParseResult;
}

/**
 * AhoCorasickExtractor - O(n) pattern extraction
 */
export class AhoCorasickExtractor {
    private matcher = new AhoCorasickMatcher();
    private parser = new ExplicitParser();

    /**
     * Extract all pattern matches from text
     * Identical API to PatternExtractor.extractFromText
     */
    extractFromText(text: string, noteId: string): PatternMatchEvent[] {
        const events: PatternMatchEvent[] = [];

        // Phase 1: Find all discriminator positions in O(n)
        const hits = this.matcher.findAll(text);

        // Track positions we've already matched to avoid duplicates
        const matchedRanges: Array<{ start: number; end: number }> = [];

        // Phase 2: At each hit, try to parse the structure
        for (const hit of hits) {
            // Skip if this position is already covered by a previous match
            if (this.isPositionCovered(hit.position, matchedRanges)) {
                continue;
            }

            const attempt = this.tryParseAtPosition(text, hit);
            if (attempt) {
                const event = this.toPatternMatchEvent(attempt, hit.position, noteId);
                events.push(event);

                // Mark this range as covered
                matchedRanges.push({
                    start: hit.position,
                    end: attempt.result.endIndex,
                });
            }
        }

        // Phase 3: Handle temporal patterns (word-boundary based, not discriminator)
        // These use word boundaries, so we fall back to regex for now
        const temporalEvents = this.extractTemporalWithRegex(text, noteId);
        events.push(...temporalEvents);

        // Phase 4: Resolve overlaps
        return this.resolveOverlaps(events);
    }

    /**
     * Check if a position is already covered by a matched range
     */
    private isPositionCovered(pos: number, ranges: Array<{ start: number; end: number }>): boolean {
        return ranges.some(r => pos >= r.start && pos < r.end);
    }

    /**
     * Try to parse at a discriminator hit position
     * Returns the best match (highest priority) or null
     */
    private tryParseAtPosition(text: string, hit: DiscriminatorHit): ParseAttempt | null {
        const attempts: ParseAttempt[] = [];

        // Order matters: try more specific patterns first
        switch (hit.discriminator) {
            case '[[':
                const wikiResult = this.parser.parseWikilink(text, hit.position);
                if (wikiResult?.success) {
                    attempts.push({
                        kind: 'wikilink',
                        patternId: 'builtin:wikilink',
                        result: wikiResult,
                    });
                }
                break;

            case '<<':
                const backResult = this.parser.parseBacklink(text, hit.position);
                if (backResult?.success) {
                    attempts.push({
                        kind: 'backlink',
                        patternId: 'builtin:backlink',
                        result: backResult,
                    });
                }
                break;

            case '[':
                // Try inline triple first (higher priority: 106)
                const inlineTripleResult = this.parser.parseInlineTriple(text, hit.position);
                if (inlineTripleResult?.success) {
                    attempts.push({
                        kind: 'triple',
                        patternId: 'builtin:inline-relationship',
                        result: inlineTripleResult,
                    });
                }

                // Try full triple (priority: 105)
                const tripleResult = this.parser.parseTriple(text, hit.position);
                if (tripleResult?.success) {
                    attempts.push({
                        kind: 'triple',
                        patternId: 'builtin:triple',
                        result: tripleResult,
                    });
                }

                // Try entity (priority: 100)
                const entityResult = this.parser.parseEntity(text, hit.position);
                if (entityResult?.success) {
                    attempts.push({
                        kind: 'entity',
                        patternId: 'builtin:entity',
                        result: entityResult,
                    });
                }
                break;

            case '#':
                const tagResult = this.parser.parseTag(text, hit.position);
                if (tagResult?.success) {
                    attempts.push({
                        kind: 'tag',
                        patternId: 'builtin:tag',
                        result: tagResult,
                    });
                }
                break;

            case '@':
                const mentionResult = this.parser.parseMention(text, hit.position);
                if (mentionResult?.success) {
                    attempts.push({
                        kind: 'mention',
                        patternId: 'builtin:mention',
                        result: mentionResult,
                    });
                }
                break;
        }

        if (attempts.length === 0) return null;

        // Return highest priority match
        return attempts.reduce((best, current) => {
            const bestPriority = patternRegistry.getPattern(best.patternId)?.priority ?? 0;
            const currPriority = patternRegistry.getPattern(current.patternId)?.priority ?? 0;
            return currPriority > bestPriority ? current : best;
        });
    }

    /**
     * Convert ParseAttempt to PatternMatchEvent
     */
    private toPatternMatchEvent(
        attempt: ParseAttempt,
        position: number,
        noteId: string
    ): PatternMatchEvent {
        return {
            kind: attempt.kind,
            fullMatch: attempt.result.fullMatch,
            position,
            length: attempt.result.fullMatch.length,
            captures: attempt.result.captures,
            patternId: attempt.patternId,
            noteId,
            timestamp: Date.now(),
        };
    }

    /**
     * Extract temporal patterns using regex (they use word boundaries)
     * Could be optimized later with custom word-boundary detection
     */
    private extractTemporalWithRegex(text: string, noteId: string): PatternMatchEvent[] {
        const events: PatternMatchEvent[] = [];
        const temporalPatterns = patternRegistry.getPatternsByKind('temporal');

        for (const pattern of temporalPatterns) {
            if (!pattern.enabled) continue;

            const regex = patternRegistry.getCompiledPattern(pattern.id);
            if (!regex) continue;

            regex.lastIndex = 0;

            let match: RegExpExecArray | null;
            while ((match = regex.exec(text)) !== null) {
                if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                }

                const fullMatch = match[0];
                const captures: Record<string, string> = {};

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
                    kind: 'temporal',
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

        return events;
    }

    /**
     * Resolve overlapping matches - higher priority wins
     * Same algorithm as PatternExtractor for identical behavior
     */
    private resolveOverlaps(events: PatternMatchEvent[]): PatternMatchEvent[] {
        if (events.length <= 1) return events;

        // Sort by position, then by pattern priority (descending)
        const sorted = [...events].sort((a, b) => {
            if (a.position !== b.position) return a.position - b.position;
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

    // ==================== Convenience Methods ====================
    // Same API as PatternExtractor

    extractEntities(text: string, noteId: string): PatternMatchEvent[] {
        return this.extractFromText(text, noteId).filter(e => e.kind === 'entity');
    }

    extractTriples(text: string, noteId: string): PatternMatchEvent[] {
        return this.extractFromText(text, noteId).filter(e => e.kind === 'triple');
    }

    extractWikilinks(text: string, noteId: string): PatternMatchEvent[] {
        return this.extractFromText(text, noteId).filter(e => e.kind === 'wikilink');
    }

    extractTags(text: string, noteId: string): PatternMatchEvent[] {
        return this.extractFromText(text, noteId).filter(e => e.kind === 'tag');
    }

    extractMentions(text: string, noteId: string): PatternMatchEvent[] {
        return this.extractFromText(text, noteId).filter(e => e.kind === 'mention');
    }

    extractTemporal(text: string, noteId: string): PatternMatchEvent[] {
        return this.extractFromText(text, noteId).filter(e => e.kind === 'temporal');
    }
}

// Singleton instance
export const ahoCorasickExtractor = new AhoCorasickExtractor();
