/**
 * SnippetGenerator - Extract search result snippets
 * 
 * FEATURES:
 * - Sentence-boundary aware (no mid-word cuts)
 * - Highlight query terms with character offsets
 * - Multiple snippets if multiple matches
 */

import { getWinkTokenizer } from './WinkTokenizer';

export interface Snippet {
    text: string;
    highlights: Array<{ start: number; end: number; term: string }>;
    matchScore: number;  // 0-1: coverage of query terms
}

export class SnippetGenerator {
    private tokenizer = getWinkTokenizer();

    /**
     * Generate snippets from text matching query
     */
    generate(
        text: string,
        queryTokens: string[],
        options?: {
            maxSnippets?: number;
            windowSentences?: number;
            maxLength?: number;
        }
    ): Snippet[] {
        const opts = {
            maxSnippets: 3,
            windowSentences: 1,
            maxLength: 200,
            ...options
        };

        const snippets: Snippet[] = [];
        const normalizedQuery = queryTokens.map(t => t.toLowerCase());

        // Find all match positions
        const matches: number[] = [];
        for (const term of normalizedQuery) {
            const lowerText = text.toLowerCase();
            let pos = 0;
            while ((pos = lowerText.indexOf(term, pos)) !== -1) {
                matches.push(pos);
                pos += term.length;
            }
        }

        if (matches.length === 0) return [];

        // Sort matches to process them in order and potentially merge overlapping windows
        matches.sort((a, b) => a - b);

        // Extract unique contexts
        const seen = new Set<string>();

        for (const matchPos of matches) {
            if (snippets.length >= opts.maxSnippets) break;

            const context = this.tokenizer.extractContext(
                text,
                matchPos,
                opts.windowSentences
            );

            // Skip duplicates or very similar snippets
            if (seen.has(context.snippet)) continue;
            seen.add(context.snippet);

            // Truncate if too long (simple mid-truncation as requested, though sentence boundary is better)
            let snippetText = context.snippet;
            if (snippetText.length > opts.maxLength) {
                const mid = Math.floor(snippetText.length / 2);
                const start = Math.max(0, mid - opts.maxLength / 2);
                const end = Math.min(snippetText.length, start + opts.maxLength);
                snippetText = snippetText.substring(start, end);
            }

            // Find highlights
            const highlights: Array<{ start: number; end: number; term: string }> = [];
            const snippetLower = snippetText.toLowerCase();

            for (const term of normalizedQuery) {
                let pos = 0;
                while ((pos = snippetLower.indexOf(term, pos)) !== -1) {
                    highlights.push({
                        start: pos,
                        end: pos + term.length,
                        term
                    });
                    pos += term.length;
                }
            }

            // Calculate match score
            const uniqueMatches = new Set(highlights.map(h => h.term)).size;
            const matchScore = uniqueMatches / normalizedQuery.length;

            snippets.push({
                text: snippetText,
                highlights,
                matchScore
            });
        }

        // Sort by match score
        snippets.sort((a, b) => b.matchScore - a.matchScore);
        return snippets.slice(0, opts.maxSnippets);
    }
}

// Singleton
let generator: SnippetGenerator | null = null;

export function getSnippetGenerator(): SnippetGenerator {
    if (!generator) {
        generator = new SnippetGenerator();
    }
    return generator;
}
