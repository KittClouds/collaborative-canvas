/**
 * AdaptiveWindowGenerator - Smart n-gram candidate extraction
 * 
 * Optimization strategy:
 * 1. Start with 1-2 grams (covers ~70% of entities)
 * 2. If 1-2 gram matches entity prefix → expand to 3-5 grams
 * 3. Stop if gap between tokens > threshold
 */

import { entityRegistry } from '../entity-registry';
import { PrefixTrie } from './PrefixTrie';
import { getContextExtractor } from './ContextExtractor';

export interface EntityCandidate {
    text: string;           // Original text span
    normalized: string;     // Normalized for matching
    startPos: number;       // Character offset in document
    endPos: number;         // Character offset (inclusive)
    tokenCount: number;     // Number of tokens in span
    context: string;        // Surrounding text (±50 chars)
    entityIds: Set<string>; // NEW in Phase 1: Prefiltered entity IDs from Trie
}

export interface EntityLengthStats {
    oneToken: number;
    twoToken: number;
    threeToken: number;
    fourToken: number;
    fivePlusToken: number;
}

export class AdaptiveWindowGenerator {
    private text: string;
    private candidateTokens: Array<{ token: string; position: number; entityIds: Set<string> }>;
    private trie: PrefixTrie;

    constructor(
        text: string,
        candidateTokens: Array<{ token: string; position: number; entityIds: Set<string> }>,
        trie: PrefixTrie
    ) {
        this.text = text;
        this.candidateTokens = candidateTokens;
        this.trie = trie;
    }

    /**
     * Generate candidates with adaptive window sizing
     */
    generateCandidates(): EntityCandidate[] {
        const candidates: EntityCandidate[] = [];
        const seen = new Set<string>();

        for (let i = 0; i < this.candidateTokens.length; i++) {
            // TIER 1: Try 1-gram
            const oneGram = this.createCandidate(i, i + 1);
            if (oneGram && !seen.has(this.getSpanKey(oneGram))) {
                candidates.push(oneGram);
                seen.add(this.getSpanKey(oneGram));
            }

            // TIER 2: Try 2-gram if adjacent
            if (i + 1 < this.candidateTokens.length && this.areTokensAdjacent(i, i + 1)) {
                const twoGram = this.createCandidate(i, i + 2);
                if (twoGram && !seen.has(this.getSpanKey(twoGram))) {
                    candidates.push(twoGram);
                    seen.add(this.getSpanKey(twoGram));

                    // OPTIMIZATION: Check if 2-gram is a prefix match
                    if (this.isPrefixOfEntity(twoGram.normalized)) {
                        // TIER 3: Expand to 3-5 grams
                        for (let len = 3; len <= 5 && i + len <= this.candidateTokens.length; len++) {
                            if (!this.areTokensAdjacent(i + len - 2, i + len - 1)) break;

                            const nGram = this.createCandidate(i, i + len);
                            if (nGram && !seen.has(this.getSpanKey(nGram))) {
                                candidates.push(nGram);
                                seen.add(this.getSpanKey(nGram));

                                // Continue expansion only if this nGram is still a prefix
                                if (!this.isPrefixOfEntity(nGram.normalized)) break;
                            }
                        }
                    }
                }
            }
        }

        return candidates;
    }

    private getSpanKey(c: EntityCandidate): string {
        return `${c.startPos}:${c.endPos}`;
    }

    /**
     * Check if text is prefix of any registered entity
     */
    private isPrefixOfEntity(text: string): boolean {
        const prefixMatches = this.trie.searchPrefix(text);
        return prefixMatches.length > 0;
    }

    /**
     * Check if tokens are adjacent (no large gaps)
     */
    private areTokensAdjacent(idxA: number, idxB: number): boolean {
        const tokenA = this.candidateTokens[idxA];
        const tokenB = this.candidateTokens[idxB];
        const gap = tokenB.position - (tokenA.position + tokenA.token.length);
        return gap < 20;
    }

    /**
     * Create candidate from token range
     */
    private createCandidate(startIdx: number, endIdx: number): EntityCandidate | null {
        if (startIdx >= this.candidateTokens.length || endIdx > this.candidateTokens.length) {
            return null;
        }

        const tokens = this.candidateTokens.slice(startIdx, endIdx);
        const textStr = tokens.map(t => t.token).join(' ');
        const normalized = textStr.toLowerCase().trim();

        const startPos = tokens[0].position;
        const lastToken = tokens[tokens.length - 1];
        const endPos = lastToken.position + lastToken.token.length;

        // Extract context (using sentence boundaries)
        const extractor = getContextExtractor();
        const extraction = extractor.extractContext(this.text, startPos, endPos, 0); // Window = 0 (just the sentence)
        const context = extraction.snippet;

        // Merge entity IDs from all tokens
        const entityIds = new Set<string>();
        for (const token of tokens) {
            for (const id of token.entityIds) {
                entityIds.add(id);
            }
        }

        return {
            text: textStr,
            normalized,
            startPos,
            endPos,
            tokenCount: tokens.length,
            context,
            entityIds,
        };
    }

    /**
     * Calculate entity length distribution from registry
     */
    calculateEntityLengthStats(): EntityLengthStats {
        const entities = entityRegistry.getAllEntities();
        const total = entities.length;

        if (total === 0) {
            return { oneToken: 0, twoToken: 0, threeToken: 0, fourToken: 0, fivePlusToken: 0 };
        }

        let stats = { oneToken: 0, twoToken: 0, threeToken: 0, fourToken: 0, fivePlusToken: 0 };

        for (const entity of entities) {
            const tokenCount = entity.label.split(/\s+/).length;
            if (tokenCount === 1) stats.oneToken++;
            else if (tokenCount === 2) stats.twoToken++;
            else if (tokenCount === 3) stats.threeToken++;
            else if (tokenCount === 4) stats.fourToken++;
            else stats.fivePlusToken++;
        }

        return {
            oneToken: (stats.oneToken / total) * 100,
            twoToken: (stats.twoToken / total) * 100,
            threeToken: (stats.threeToken / total) * 100,
            fourToken: (stats.fourToken / total) * 100,
            fivePlusToken: (stats.fivePlusToken / total) * 100,
        };
    }
}
