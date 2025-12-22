/**
 * RefConstraintEngine - Enforces invariants on Refs
 * 
 * Handles uniqueness, validation, and scope rules.
 */

import type { Ref, RefKind, EntityRefPayload, TripleRefPayload } from './types';

/**
 * Predicate rules: Which predicates are allowed for which entity kinds
 */
const PREDICATE_RULES: Record<string, string[]> = {
    CHARACTER: ['KNOWS', 'LOVES', 'HATES', 'RELATED_TO', 'WORKS_WITH', 'MENTORS', 'RIVALS'],
    PERSON: ['KNOWS', 'LOVES', 'HATES', 'RELATED_TO', 'WORKS_WITH', 'MENTORS', 'RIVALS'],
    LOCATION: ['CONTAINS', 'NEAR', 'CONNECTED_TO', 'PART_OF'],
    ORGANIZATION: ['OWNS', 'EMPLOYS', 'ALLIED_WITH', 'RIVALS', 'PART_OF'],
    EVENT: ['INVOLVES', 'CAUSES', 'PRECEDES', 'FOLLOWS'],
    ITEM: ['BELONGS_TO', 'CREATED_BY', 'USED_BY', 'PART_OF'],
    CONCEPT: ['RELATED_TO', 'IMPLIES', 'CONTRADICTS', 'PART_OF'],
};

/**
 * Constraint validation result
 */
export interface ConstraintResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * RefConstraintEngine Class
 */
export class RefConstraintEngine {
    /**
     * Validate a single ref
     */
    validate(ref: Ref): ConstraintResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Basic validation
        if (!ref.id) {
            errors.push('Ref must have an id');
        }
        if (!ref.kind) {
            errors.push('Ref must have a kind');
        }
        if (!ref.target) {
            errors.push('Ref must have a target');
        }
        if (!ref.sourceNoteId) {
            errors.push('Ref must have a sourceNoteId');
        }

        // Kind-specific validation
        switch (ref.kind) {
            case 'entity':
                this.validateEntity(ref as Ref<EntityRefPayload>, errors, warnings);
                break;
            case 'triple':
                this.validateTriple(ref as Ref<TripleRefPayload>, errors, warnings);
                break;
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validate entity ref
     */
    private validateEntity(ref: Ref<EntityRefPayload>, errors: string[], warnings: string[]): void {
        const payload = ref.payload;

        if (!payload?.entityKind) {
            errors.push('Entity ref must have entityKind in payload');
        }

        // Check for very short labels
        if (ref.target.length < 2) {
            warnings.push(`Entity label "${ref.target}" is very short`);
        }

        // Check for suspicious characters
        if (/[<>{}[\]|]/.test(ref.target)) {
            warnings.push(`Entity label "${ref.target}" contains suspicious characters`);
        }
    }

    /**
     * Validate triple ref
     */
    private validateTriple(ref: Ref<TripleRefPayload>, errors: string[], warnings: string[]): void {
        const payload = ref.payload;

        if (!payload?.subjectKind || !payload?.subjectLabel) {
            errors.push('Triple ref must have subject');
        }
        if (!payload?.objectKind || !payload?.objectLabel) {
            errors.push('Triple ref must have object');
        }
        if (!ref.predicate) {
            errors.push('Triple ref must have predicate');
        }

        // Validate predicate is allowed for subject kind
        if (payload?.subjectKind && ref.predicate) {
            const allowed = PREDICATE_RULES[payload.subjectKind];
            if (allowed && !allowed.includes(ref.predicate)) {
                warnings.push(
                    `Predicate "${ref.predicate}" is unusual for ${payload.subjectKind}. ` +
                    `Expected: ${allowed.join(', ')}`
                );
            }
        }
    }

    /**
     * Enforce uniqueness across refs
     * Merges duplicate refs and accumulates positions
     */
    enforceUniqueness(refs: Ref[]): Ref[] {
        const seen = new Map<string, Ref>();

        for (const ref of refs) {
            const key = this.getUniqueKey(ref);
            const existing = seen.get(key);

            if (existing) {
                // Merge positions
                existing.positions.push(...ref.positions);
                // Update last seen
                existing.lastSeenAt = Math.max(existing.lastSeenAt, ref.lastSeenAt);
                // Merge attributes if present
                if (ref.attributes) {
                    existing.attributes = { ...existing.attributes, ...ref.attributes };
                }
            } else {
                seen.set(key, { ...ref, positions: [...ref.positions] });
            }
        }

        return Array.from(seen.values());
    }

    /**
     * Generate a unique key for deduplication
     */
    private getUniqueKey(ref: Ref): string {
        const scopePath = ref.scope.path || '';

        switch (ref.kind) {
            case 'entity': {
                const payload = ref.payload as EntityRefPayload;
                return `entity:${payload.entityKind}:${ref.target.toLowerCase()}:${scopePath}`;
            }
            case 'wikilink':
                return `wikilink:${ref.target.toLowerCase()}:${scopePath}`;
            case 'backlink':
                return `backlink:${ref.target.toLowerCase()}:${scopePath}`;
            case 'tag':
                return `tag:${ref.target.toLowerCase()}`;
            case 'mention':
                return `mention:${ref.target.toLowerCase()}`;
            case 'triple':
                return `triple:${ref.target}:${ref.predicate}`;
            case 'temporal':
                return `temporal:${ref.target}:${ref.sourceNoteId}:${ref.positions[0]?.offset}`;
            default:
                return `${ref.kind}:${ref.target}:${ref.sourceNoteId}`;
        }
    }

    /**
     * Filter refs by scope
     */
    filterByScope(
        refs: Ref[],
        scope: { type: 'note' | 'folder' | 'vault'; path?: string }
    ): Ref[] {
        return refs.filter(ref => {
            switch (scope.type) {
                case 'note':
                    return ref.scope.type === 'note' && ref.scope.path === scope.path;
                case 'folder':
                    return ref.scope.path?.startsWith(scope.path || '') ?? true;
                case 'vault':
                    return true;
                default:
                    return true;
            }
        });
    }

    /**
     * Validate predicate for entity kind
     */
    validatePredicate(entityKind: string, predicate: string): boolean {
        const allowed = PREDICATE_RULES[entityKind];
        return !allowed || allowed.includes(predicate);
    }

    /**
     * Get allowed predicates for an entity kind
     */
    getAllowedPredicates(entityKind: string): string[] {
        return PREDICATE_RULES[entityKind] || [];
    }
}

// Singleton instance
export const refConstraintEngine = new RefConstraintEngine();
