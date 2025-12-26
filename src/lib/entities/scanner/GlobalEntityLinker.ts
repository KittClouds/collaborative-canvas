/**
 * GlobalEntityLinker - Semantic deduplication and global entity linking
 * 
 * Leverages:
 * - EntityRegistry.mergeEntities() for data consolidation
 * - Levenshtein distance for lexical similarity
 * - Relationship migration via callbacks
 */

import { entityRegistry, type RegisteredEntity } from '@/lib/cozo/graph/adapters';
import { EntityKind } from '../entityTypes';

export interface DuplicateCandidate {
    entity1: RegisteredEntity;
    entity2: RegisteredEntity;
    similarity: number;
    reason: 'lexical' | 'alias' | 'co-occurrence';
}

export class GlobalEntityLinker {
    /**
     * Detect potential duplicate entities across the registry
     */
    async detectDuplicates(): Promise<DuplicateCandidate[]> {
        const entities = entityRegistry.getAllEntities();
        const candidates: DuplicateCandidate[] = [];

        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const e1 = entities[i];
                const e2 = entities[j];

                // Skip if different kinds
                if (e1.kind !== e2.kind) continue;

                // 1. Lexical similarity (Levenshtein)
                const lexicalSim = this.calculateLexicalSimilarity(e1.label, e2.label);

                if (lexicalSim > 0.85) {
                    candidates.push({
                        entity1: e1,
                        entity2: e2,
                        similarity: lexicalSim,
                        reason: 'lexical'
                    });
                    continue;
                }

                // 2. Alias overlap
                if (this.hasAliasOverlap(e1, e2)) {
                    candidates.push({
                        entity1: e1,
                        entity2: e2,
                        similarity: 0.95,
                        reason: 'alias'
                    });
                }
            }
        }

        return candidates.sort((a, b) => b.similarity - a.similarity);
    }

    /**
     * Merge entities and verify downstream updates
     */
    mergeEntities(canonicalId: string, duplicateId: string): boolean {
        // EntityRegistry.mergeEntities handles metadata, aliases, and triggers relationship migration
        return entityRegistry.mergeEntities(canonicalId, duplicateId);
    }

    /**
     * Calculate lexical similarity using Levenshtein distance
     */
    private calculateLexicalSimilarity(s1: string, s2: string): number {
        const l1 = s1.toLowerCase();
        const l2 = s2.toLowerCase();
        if (l1 === l2) return 1.0;

        const distance = this.levenshtein(l1, l2);
        const maxLen = Math.max(l1.length, l2.length);
        return 1 - (distance / maxLen);
    }

    private hasAliasOverlap(e1: RegisteredEntity, e2: RegisteredEntity): boolean {
        const a1 = new Set([e1.label.toLowerCase(), ...(e1.aliases || []).map(a => a.toLowerCase())]);
        const a2 = new Set([e2.label.toLowerCase(), ...(e2.aliases || []).map(a => a.toLowerCase())]);

        for (const alias of a1) {
            if (a2.has(alias)) return true;
        }
        return false;
    }

    private levenshtein(a: string, b: string): number {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }
}

// Singleton
export const globalEntityLinker = new GlobalEntityLinker();
