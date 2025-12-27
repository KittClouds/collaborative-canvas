import { entityRegistry } from '@/lib/cozo/graph/adapters';
import type { RegisteredEntity } from '@/lib/cozo/graph/adapters/EntityRegistryAdapter';

export interface ImplicitMatch {
    entity: RegisteredEntity;
    position: number;
    length: number;
    matchedText: string;
    confidence: 'high' | 'medium' | 'low';
}

/**
 * Finds implicit entity mentions in plain text
 * 
 * This detects when a registered entity's label or alias appears
 * in prose text (not using [KIND|Label] syntax).
 */
export class ImplicitEntityMatcher {
    /**
     * Find all implicit mentions in text
     */
    findImplicitMentions(text: string, noteId: string): ImplicitMatch[] {
        const matches: ImplicitMatch[] = [];

        // Get all registered entities from the registry
        const allEntities = entityRegistry.getAllEntities();

        if (allEntities.length === 0) return matches;

        const lowerText = text.toLowerCase();
        const processed = new Set<number>(); // Avoid overlaps

        // Sort entities by label length (longest first for better matching)
        // This ensures "Frodo Baggins" is matched before "Frodo"
        const sortedEntities = [...allEntities].sort(
            (a, b) => b.label.length - a.label.length
        );

        for (const entity of sortedEntities) {
            // Skip very short labels (likely false positives)
            if (entity.label.length < 3) continue;

            // Check main label
            this.findMatchesForPattern(
                entity,
                entity.label,
                text,
                lowerText,
                matches,
                processed,
                'high'
            );

            // Check aliases
            if (entity.aliases && entity.aliases.length > 0) {
                for (const alias of entity.aliases) {
                    if (alias.length < 3) continue; // Skip short aliases

                    this.findMatchesForPattern(
                        entity,
                        alias,
                        text,
                        lowerText,
                        matches,
                        processed,
                        'medium'
                    );
                }
            }
        }

        // Sort by position for consistent ordering
        matches.sort((a, b) => a.position - b.position);

        return matches;
    }

    /**
     * Find matches for a specific pattern
     */
    private findMatchesForPattern(
        entity: RegisteredEntity,
        pattern: string,
        originalText: string,
        lowerText: string,
        matches: ImplicitMatch[],
        processed: Set<number>,
        confidence: 'high' | 'medium' | 'low'
    ): void {
        const lowerPattern = pattern.toLowerCase();
        const patternLength = pattern.length;

        let startIdx = 0;
        while ((startIdx = lowerText.indexOf(lowerPattern, startIdx)) !== -1) {
            const endIdx = startIdx + patternLength;

            // Check if this range overlaps with already processed
            let hasOverlap = false;
            for (let i = startIdx; i < endIdx; i++) {
                if (processed.has(i)) {
                    hasOverlap = true;
                    break;
                }
            }

            if (!hasOverlap) {
                // Check word boundaries (don't match inside words)
                const beforeChar = startIdx > 0 ? originalText[startIdx - 1] : ' ';
                const afterChar = endIdx < originalText.length ? originalText[endIdx] : ' ';
                const isWordBoundary =
                    /[\s\p{P}]/u.test(beforeChar) && /[\s\p{P}]/u.test(afterChar);

                if (isWordBoundary) {
                    // Mark as processed
                    for (let i = startIdx; i < endIdx; i++) {
                        processed.add(i);
                    }

                    matches.push({
                        entity,
                        position: startIdx,
                        length: patternLength,
                        matchedText: originalText.substring(startIdx, endIdx),
                        confidence,
                    });
                }
            }

            startIdx = endIdx;
        }
    }

    /**
     * Check if text position is inside explicit entity syntax
     * (to avoid double-matching [KIND|Label] as implicit)
     */
    isInsideExplicitSyntax(text: string, position: number): boolean {
        // Find last '[' before position
        let bracketStart = -1;
        for (let i = position - 1; i >= 0; i--) {
            if (text[i] === '[') {
                bracketStart = i;
                break;
            }
            if (text[i] === ']') {
                // Hit closing bracket first, not inside syntax
                break;
            }
        }

        if (bracketStart === -1) return false;

        // Find next ']' after position
        const bracketEnd = text.indexOf(']', position);
        if (bracketEnd === -1) return false;

        // Check if this looks like entity syntax [KIND|...]
        const between = text.substring(bracketStart + 1, bracketEnd);
        return /^[A-Z_]+[:|]/.test(between);
    }

    /**
     * Filter out matches that are inside explicit syntax
     */
    filterExplicitSyntax(text: string, matches: ImplicitMatch[]): ImplicitMatch[] {
        return matches.filter(m => !this.isInsideExplicitSyntax(text, m.position));
    }
}

export const implicitEntityMatcher = new ImplicitEntityMatcher();
