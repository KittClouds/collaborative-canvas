/**
 * RelationshipIntegrityChecker - Validate and repair relationship data
 * 
 * Checks for:
 * - Orphaned relationships (entity no longer exists)
 * - Duplicate relationships
 * - Invalid relationship types
 */

import type { RelationshipRegistry } from './relationship-registry';
import type { EntityRegistry } from '@/lib/entities/entity-registry';
import type { IntegrityIssue, RepairResult, UnifiedRelationship } from './types';

export class RelationshipIntegrityChecker {
    constructor(
        private relationshipRegistry: RelationshipRegistry,
        private entityRegistry: EntityRegistry
    ) {}

    /**
     * Check integrity of all relationships
     * Returns list of issues found
     */
    checkIntegrity(): IntegrityIssue[] {
        const issues: IntegrityIssue[] = [];
        const seenComposites = new Map<string, string>();

        for (const rel of this.relationshipRegistry.getAll()) {
            if (!this.entityRegistry.getEntityById(rel.sourceEntityId)) {
                issues.push({
                    type: 'ORPHAN_SOURCE',
                    relationshipId: rel.id,
                    entityId: rel.sourceEntityId,
                    message: `Source entity ${rel.sourceEntityId} not found`
                });
            }

            if (!this.entityRegistry.getEntityById(rel.targetEntityId)) {
                issues.push({
                    type: 'ORPHAN_TARGET',
                    relationshipId: rel.id,
                    entityId: rel.targetEntityId,
                    message: `Target entity ${rel.targetEntityId} not found`
                });
            }

            const compositeKey = `${rel.sourceEntityId}:${rel.type}:${rel.targetEntityId}:${rel.namespace || ''}`;
            if (seenComposites.has(compositeKey)) {
                issues.push({
                    type: 'DUPLICATE',
                    relationshipId: rel.id,
                    message: `Duplicate relationship: ${rel.sourceEntityId} -[${rel.type}]-> ${rel.targetEntityId}`
                });
            } else {
                seenComposites.set(compositeKey, rel.id);
            }

            if (!rel.type || rel.type.trim() === '') {
                issues.push({
                    type: 'INVALID_TYPE',
                    relationshipId: rel.id,
                    message: 'Relationship has empty or invalid type'
                });
            }
        }

        return issues;
    }

    /**
     * Repair integrity issues
     */
    repairIntegrity(issues: IntegrityIssue[]): RepairResult {
        let removed = 0;
        let merged = 0;

        const duplicateGroups = new Map<string, IntegrityIssue[]>();

        for (const issue of issues) {
            if (issue.type === 'DUPLICATE') {
                const rel = this.relationshipRegistry.get(issue.relationshipId);
                if (rel) {
                    const key = `${rel.sourceEntityId}:${rel.type}:${rel.targetEntityId}:${rel.namespace || ''}`;
                    if (!duplicateGroups.has(key)) {
                        duplicateGroups.set(key, []);
                    }
                    duplicateGroups.get(key)!.push(issue);
                }
            }
        }

        for (const issue of issues) {
            switch (issue.type) {
                case 'ORPHAN_SOURCE':
                case 'ORPHAN_TARGET':
                    if (this.relationshipRegistry.delete(issue.relationshipId)) {
                        removed++;
                    }
                    break;

                case 'INVALID_TYPE':
                    if (this.relationshipRegistry.delete(issue.relationshipId)) {
                        removed++;
                    }
                    break;

                case 'DUPLICATE':
                    break;
            }
        }

        for (const [key, dupeIssues] of duplicateGroups) {
            if (dupeIssues.length < 2) continue;

            const rels: UnifiedRelationship[] = [];
            for (const issue of dupeIssues) {
                const rel = this.relationshipRegistry.get(issue.relationshipId);
                if (rel) rels.push(rel);
            }

            if (rels.length < 2) continue;

            rels.sort((a, b) => b.confidence - a.confidence);
            const keepRel = rels[0];

            for (let i = 1; i < rels.length; i++) {
                const dupeRel = rels[i];
                this.relationshipRegistry.mergeRelationships(keepRel.id, dupeRel.id);
                merged++;
            }
        }

        return { removed, merged };
    }

    /**
     * Get summary statistics for integrity
     */
    getIntegritySummary(): {
        totalRelationships: number;
        orphanedSource: number;
        orphanedTarget: number;
        duplicates: number;
        invalidTypes: number;
    } {
        const issues = this.checkIntegrity();
        
        return {
            totalRelationships: this.relationshipRegistry.getAll().length,
            orphanedSource: issues.filter(i => i.type === 'ORPHAN_SOURCE').length,
            orphanedTarget: issues.filter(i => i.type === 'ORPHAN_TARGET').length,
            duplicates: issues.filter(i => i.type === 'DUPLICATE').length,
            invalidTypes: issues.filter(i => i.type === 'INVALID_TYPE').length
        };
    }
}
