/**
 * EntityMatcherWorker - Parallel entity mention detection via Web Worker
 * 
 * ARCHITECTURE:
 * - Runs off main thread (non-blocking UI)
 * - Aho-Corasick algorithm for multi-pattern matching
 * - Processes all sentences in a single pass
 * - Caches trie structure across calls
 * 
 * PERFORMANCE:
 * - Sequential: O(N * M * K) where N=entities, M=sentences, K=aliases
 * - This worker: O((N*K) + M*L) where L=avg sentence length
 * - Expected speedup: 5x for 1000+ entities
 * 
 * INTEGRATION:
 * - Called via Comlink from documentScanner.ts
 * - Stateful: trie persists between calls (same entity set)
 * - Invalidation: rebuild when entity count changes
 */

import type { WorkerMatch } from './types';

// ==================== MESSAGE TYPES ====================

export interface EntityMatchRequest {
    type: 'MATCH_ENTITIES';
    payload: {
        sentences: Array<{
            text: string;
            start: number;
            end: number;
            index: number;
        }>;
        entities: Array<{
            id: string;
            label: string;
            aliases: string[];
            kind: string;
        }>;
        rebuildTrie?: boolean;  // Force trie rebuild
    };
}

export interface EntityMatchResponse {
    type: 'MATCH_COMPLETE';
    payload: {
        mentions: WorkerMatch[];
        stats: {
            entitiesChecked: number;
            mentionsFound: number;
            processingTimeMs: number;
            trieRebuilt: boolean;
        };
    };
}

// ==================== AHO-CORASICK TRIE ====================

interface TrieNode {
    children: Map<string, TrieNode>;
    output: Array<{ entityId: string; term: string; originalCase: string }>;
    fail: TrieNode | null;
}

/**
 * Aho-Corasick automaton for multi-pattern string matching
 * 
 * COMPLEXITY:
 * - Build: O(sum of pattern lengths)
 * - Search: O(text length + matches)
 * 
 * REFERENCE: https://en.wikipedia.org/wiki/Aho%E2%80%93Corasick_algorithm
 */
export class AhoCorasickMatcher {
    private root: TrieNode = { children: new Map(), output: [], fail: null };
    private entityCount: number = 0;

    /**
     * Build trie from entity search terms
     */
    build(entities: Array<{ id: string; label: string; aliases: string[] }>): void {
        // Reset
        this.root = { children: new Map(), output: [], fail: null };
        this.entityCount = entities.length;

        // Phase 1: Insert all patterns
        for (const entity of entities) {
            const terms = [entity.label, ...(entity.aliases || [])];

            for (const term of terms) {
                if (term && term.length > 0) {
                    this.addPattern(term.toLowerCase(), entity.id, term);
                }
            }
        }

        // Phase 2: Build failure function (KMP-style suffix links)
        this.buildFailureLinks();
    }

    /**
     * Insert pattern into trie
     */
    private addPattern(
        pattern: string,
        entityId: string,
        originalCase: string
    ): void {
        let node = this.root;

        for (const char of pattern) {
            if (!node.children.has(char)) {
                node.children.set(char, {
                    children: new Map(),
                    output: [],
                    fail: null
                });
            }
            node = node.children.get(char)!;
        }

        // Mark terminal node with entity info
        node.output.push({ entityId, term: pattern, originalCase });
    }

    /**
     * Build failure links via BFS
     * Links point to longest proper suffix that's also a prefix
     */
    private buildFailureLinks(): void {
        const queue: TrieNode[] = [];

        // Root's children fail to root
        for (const child of this.root.children.values()) {
            child.fail = this.root;
            queue.push(child);
        }

        // BFS to build all failure links
        while (queue.length > 0) {
            const current = queue.shift()!;

            for (const [char, child] of current.children) {
                queue.push(child);

                // Walk failure links to find deepest node with this char
                let fail = current.fail;
                while (fail && !fail.children.has(char)) {
                    fail = fail.fail;
                }

                child.fail = fail ? fail.children.get(char)! : this.root;

                // Inherit outputs from failure link (overlapping patterns)
                if (child.fail && child.fail !== this.root) {
                    child.output.push(...child.fail.output);
                }
            }
        }
    }

    /**
     * Search text for all pattern matches
     * 
     * @param text - Text to search
     * @param absoluteOffset - Global offset (for multi-sentence docs)
     * @returns All matches with positions
     */
    search(
        text: string,
        absoluteOffset: number = 0
    ): Array<{
        entityId: string;
        term: string;
        originalCase: string;
        position: number;
    }> {
        const matches: Array<{
            entityId: string;
            term: string;
            originalCase: string;
            position: number;
        }> = [];

        const lowerText = text.toLowerCase();
        let node = this.root;

        for (let i = 0; i < lowerText.length; i++) {
            const char = lowerText[i];

            // Follow failure links until match found or root reached
            while (node !== this.root && !node.children.has(char)) {
                node = node.fail!;
            }

            // Advance if possible
            if (node.children.has(char)) {
                node = node.children.get(char)!;
            }

            // Emit all matches at this position
            for (const output of node.output) {
                const matchStart = i - output.term.length + 1;

                // Word boundary check (avoid partial matches)
                const beforeChar = matchStart > 0 ? lowerText[matchStart - 1] : ' ';
                const afterChar = i + 1 < lowerText.length ? lowerText[i + 1] : ' ';

                const isWordBoundaryBefore = /\W/.test(beforeChar) || beforeChar === ' ';
                const isWordBoundaryAfter = /\W/.test(afterChar) || afterChar === ' ';

                if (isWordBoundaryBefore && isWordBoundaryAfter) {
                    matches.push({
                        entityId: output.entityId,
                        term: output.term,
                        originalCase: output.originalCase,
                        position: absoluteOffset + matchStart
                    });
                }
            }
        }

        return matches;
    }

    getEntityCount(): number {
        return this.entityCount;
    }
}

// ==================== WORKER STATE ====================

const matcher = new AhoCorasickMatcher();
let cachedEntityCount = 0;

// ==================== MESSAGE HANDLER ====================

if (typeof self !== 'undefined') {
    self.onmessage = (event: MessageEvent<EntityMatchRequest>) => {
        const { type, payload } = event.data;

        if (type !== 'MATCH_ENTITIES') {
            return;
        }

        const startTime = performance.now();
        let trieRebuilt = false;

        try {
            // Rebuild trie if entity set changed or forced
            const entityCountChanged = payload.entities.length !== cachedEntityCount;

            if (payload.rebuildTrie || entityCountChanged || cachedEntityCount === 0) {
                matcher.build(payload.entities);
                cachedEntityCount = payload.entities.length;
                trieRebuilt = true;
            }

            const mentions: WorkerMatch[] = [];

            // Process all sentences
            for (const sentence of payload.sentences) {
                const matches = matcher.search(sentence.text, sentence.start);

                for (const match of matches) {
                    // Calculate token index (offset within sentence)
                    const relativePos = match.position - sentence.start;
                    const textBefore = sentence.text.substring(0, relativePos);
                    const tokenIndex = textBefore.split(/\s+/).filter(t => t.length > 0).length;

                    mentions.push({
                        entityId: match.entityId,
                        text: match.originalCase,  // Use original case
                        position: match.position,
                        sentenceIndex: sentence.index,
                        tokenIndex: Math.max(0, tokenIndex)
                    });
                }
            }

            // Deduplicate overlapping mentions (keep longest)
            const dedupedMentions = deduplicateMentions(mentions);

            const processingTime = performance.now() - startTime;

            const response: EntityMatchResponse = {
                type: 'MATCH_COMPLETE',
                payload: {
                    mentions: dedupedMentions,
                    stats: {
                        entitiesChecked: payload.entities.length,
                        mentionsFound: dedupedMentions.length,
                        processingTimeMs: Math.round(processingTime * 100) / 100,
                        trieRebuilt
                    }
                }
            };

            self.postMessage(response);

        } catch (error) {
            console.error('[EntityMatcherWorker] Error:', error);

            // Send error response
            self.postMessage({
                type: 'MATCH_ERROR',
                payload: {
                    error: error instanceof Error ? error.message : String(error)
                }
            } as any);
        }
    };
}

/**
 * Deduplicate overlapping mentions
 * Strategy: Keep longest match at each position
 */
function deduplicateMentions<T extends { position: number; text: string }>(
    mentions: Array<T>
): typeof mentions {
    // Sort by position, then by length (descending)
    mentions.sort((a, b) => {
        if (a.position !== b.position) {
            return a.position - b.position;
        }
        return b.text.length - a.text.length;
    });

    const result: typeof mentions = [];
    let lastEnd = -1;

    for (const mention of mentions) {
        const mentionEnd = mention.position + mention.text.length;

        // Keep if non-overlapping with previous
        if (mention.position >= lastEnd) {
            result.push(mention);
            lastEnd = mentionEnd;
        }
    }

    return result;
}

