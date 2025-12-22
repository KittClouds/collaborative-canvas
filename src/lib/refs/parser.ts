/**
 * RefParser - Unified Reference Parser
 * 
 * Parses text using registered patterns and produces Ref objects.
 * Handles priority-based matching and overlap detection.
 */

import { generateId } from '@/lib/utils/ids';
import type { Ref, RefKind, RefPosition, EntityRefPayload, WikilinkRefPayload, BacklinkRefPayload, TagRefPayload, MentionRefPayload, TripleRefPayload, TemporalRefPayload, CustomRefPayload } from './types';
import type { PatternDefinition, ParseContext, CaptureMapping } from './patterns/schema';
import { PatternRegistry, patternRegistry as defaultRegistry } from './patterns/registry';
import type { EntityKind } from '../entities/entityTypes';

/**
 * Parsed match result before Ref construction
 */
interface ParsedMatch {
    pattern: PatternDefinition;
    match: RegExpExecArray;
    captured: Record<string, string>;
    from: number;
    to: number;
}

/**
 * RefParser Class
 */
export class RefParser {
    constructor(private registry: PatternRegistry = defaultRegistry) { }

    /**
     * Parse text and return all discovered Refs
     */
    parse(text: string, context: ParseContext): Ref[] {
        const matches = this.findAllMatches(text, context);
        const nonOverlapping = this.resolveOverlaps(matches);
        return nonOverlapping.map(m => this.buildRef(m, context));
    }

    /**
     * Find all matches from all active patterns
     */
    private findAllMatches(text: string, context: ParseContext): ParsedMatch[] {
        const matches: ParsedMatch[] = [];

        for (const pattern of this.registry.getActivePatterns()) {
            const regex = this.registry.getCompiledPattern(pattern.id);
            let match: RegExpExecArray | null;

            while ((match = regex.exec(text)) !== null) {
                // Validate if validator provided
                if (pattern.validator && !pattern.validator(match, context)) {
                    continue;
                }

                // Extract captured values
                const captured = this.extractCaptures(match, pattern.captures, context);

                // Check required captures
                const hasRequired = this.hasRequiredCaptures(captured, pattern.captures);
                if (!hasRequired) continue;

                matches.push({
                    pattern,
                    match,
                    captured,
                    from: match.index,
                    to: match.index + match[0].length,
                });
            }
        }

        return matches;
    }

    /**
     * Extract and transform captured groups
     */
    private extractCaptures(
        match: RegExpExecArray,
        captures: Record<string, CaptureMapping>,
        context: ParseContext
    ): Record<string, string> {
        const result: Record<string, string> = {};

        for (const [key, mapping] of Object.entries(captures)) {
            const raw = match[mapping.group];
            if (raw !== undefined && raw !== null) {
                result[key] = mapping.transform ? mapping.transform(raw, context) : raw;
            }
        }

        return result;
    }

    /**
     * Check if all required captures are present
     */
    private hasRequiredCaptures(
        captured: Record<string, string>,
        captures: Record<string, CaptureMapping>
    ): boolean {
        for (const [key, mapping] of Object.entries(captures)) {
            if (mapping.required && !captured[key]) {
                return false;
            }
        }
        return true;
    }

    /**
     * Resolve overlapping matches using priority
     */
    private resolveOverlaps(matches: ParsedMatch[]): ParsedMatch[] {
        // Sort by: priority (desc), then by position (asc), then by length (desc)
        const sorted = [...matches].sort((a, b) => {
            if (a.pattern.priority !== b.pattern.priority) {
                return b.pattern.priority - a.pattern.priority;
            }
            if (a.from !== b.from) {
                return a.from - b.from;
            }
            return b.to - a.to; // Prefer longer matches
        });

        const result: ParsedMatch[] = [];
        const covered = new Set<number>();

        for (const m of sorted) {
            // Check if any position in this match is already covered
            let hasOverlap = false;
            for (let i = m.from; i < m.to; i++) {
                if (covered.has(i)) {
                    hasOverlap = true;
                    break;
                }
            }

            if (!hasOverlap) {
                result.push(m);
                // Mark all positions as covered
                for (let i = m.from; i < m.to; i++) {
                    covered.add(i);
                }
            }
        }

        // Re-sort by position for output
        return result.sort((a, b) => a.from - b.from);
    }

    /**
     * Build a Ref from a parsed match
     */
    private buildRef(parsed: ParsedMatch, context: ParseContext): Ref {
        const { pattern, match, captured } = parsed;
        const now = Date.now();

        // Determine target
        const target = this.determineTarget(pattern.kind, captured, match[0]);

        // Build position
        const position: RefPosition = {
            noteId: context.noteId,
            offset: parsed.from,
            length: parsed.to - parsed.from,
            contextBefore: context.fullText.slice(
                Math.max(0, parsed.from - 50),
                parsed.from
            ),
            contextAfter: context.fullText.slice(
                parsed.to,
                Math.min(context.fullText.length, parsed.to + 50)
            ),
        };

        // Build payload based on kind
        const payload = this.buildPayload(pattern.kind, captured, pattern.id);

        return {
            id: generateId(),
            kind: pattern.kind,
            scope: { type: 'note' },
            target,
            sourceNoteId: context.noteId,
            positions: [position],
            createdAt: now,
            lastSeenAt: now,
            payload,
        };
    }

    /**
     * Determine the target string based on kind
     */
    private determineTarget(kind: RefKind, captured: Record<string, string>, fullMatch: string): string {
        switch (kind) {
            case 'entity':
                return captured.label || fullMatch;
            case 'wikilink':
            case 'backlink':
                return captured.target || fullMatch;
            case 'tag':
                return captured.tagName || fullMatch;
            case 'mention':
                return captured.username || fullMatch;
            case 'triple':
                return `${captured.subjectLabel} ->${captured.predicate}-> ${captured.objectLabel}`;
            case 'temporal':
                return fullMatch;
            case 'custom':
            default:
                return captured.target || captured.label || fullMatch;
        }
    }

    /**
     * Build kind-specific payload
     */
    private buildPayload(kind: RefKind, captured: Record<string, string>, patternId: string): unknown {
        switch (kind) {
            case 'entity':
                return {
                    entityKind: captured.entityKind as EntityKind,
                    subtype: captured.subtype,
                    aliases: [],
                } satisfies EntityRefPayload;

            case 'wikilink':
                return {
                    exists: true, // Will be resolved later
                    displayText: captured.displayText,
                } satisfies WikilinkRefPayload;

            case 'backlink':
                return {
                    displayText: captured.displayText,
                } satisfies BacklinkRefPayload;

            case 'tag':
                return {
                    normalized: captured.tagName?.toLowerCase() || '',
                } satisfies TagRefPayload;

            case 'mention':
                return {
                    displayName: captured.username,
                } satisfies MentionRefPayload;

            case 'triple':
                return {
                    subjectId: '', // Will be resolved later
                    subjectKind: captured.subjectKind as EntityKind,
                    subjectLabel: captured.subjectLabel,
                    objectId: '', // Will be resolved later
                    objectKind: captured.objectKind as EntityKind,
                    objectLabel: captured.objectLabel,
                } satisfies TripleRefPayload;

            case 'temporal':
                return {
                    expression: captured.word || captured.amount
                        ? `${captured.amount || ''} ${captured.unit || ''} ${captured.direction || captured.modifier || captured.period || captured.word || ''}`.trim()
                        : '',
                    type: 'relative',
                } satisfies TemporalRefPayload;

            case 'custom':
            default:
                return {
                    patternId,
                    capturedGroups: captured,
                } satisfies CustomRefPayload;
        }
    }
}

// Singleton instance
export const refParser = new RefParser();

/**
 * Convenience function for parsing
 */
export function parseRefs(text: string, noteId: string): Ref[] {
    return refParser.parse(text, {
        noteId,
        fullText: text,
        position: 0,
    });
}
