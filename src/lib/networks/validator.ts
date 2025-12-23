/**
 * Network Validator
 * 
 * Validates network schemas, instances, and relationship operations
 * against schema constraints (cardinality, cycles, entity kinds, etc.)
 */

import type {
    NetworkSchema,
    NetworkInstance,
    NetworkRelationshipDef,
    NetworkRelationshipInstance,
    NetworkValidationResult,
    NetworkValidationError,
    NetworkValidationWarning,
} from './types';
import type { NodeId } from '@/lib/graph/types';
import { getRelationshipDef } from './types';
import { loadNetworkRelationships } from './storage';

/**
 * Network Validator class
 */
export class NetworkValidator {

    /**
     * Validate adding a new relationship
     */
    async validateAddRelationship(
        network: NetworkInstance,
        schema: NetworkSchema,
        relationshipCode: string,
        sourceId: NodeId,
        targetId: NodeId
    ): Promise<NetworkValidationResult> {
        const errors: NetworkValidationError[] = [];
        const warnings: NetworkValidationWarning[] = [];

        // Get relationship definition
        const relDef = getRelationshipDef(schema, relationshipCode);
        if (!relDef) {
            errors.push({
                code: 'INVALID_RELATIONSHIP_CODE',
                message: `Relationship code "${relationshipCode}" not found in schema "${schema.name}"`,
            });
            return { valid: false, errors, warnings };
        }

        // Check for self-loop
        if (sourceId === targetId && !relDef.allowSelfLoop) {
            errors.push({
                code: 'SELF_LOOP_NOT_ALLOWED',
                message: `${relDef.label} relationship cannot be between an entity and itself`,
                entityId: sourceId,
            });
        }

        // Load existing relationships
        const existingRels = await loadNetworkRelationships(network.id);

        // Check for duplicates
        if (!relDef.allowDuplicates) {
            const duplicate = existingRels.find(r =>
                r.relationshipCode === relationshipCode &&
                r.sourceEntityId === sourceId &&
                r.targetEntityId === targetId
            );

            if (duplicate) {
                errors.push({
                    code: 'DUPLICATE_RELATIONSHIP',
                    message: `${relDef.label} relationship already exists between these entities`,
                    relationshipId: duplicate.id,
                });
            }
        }

        // Check cardinality (maxCount)
        if (relDef.maxCount !== undefined) {
            const existingCount = existingRels.filter(r =>
                r.relationshipCode === relationshipCode &&
                r.sourceEntityId === sourceId
            ).length;

            if (existingCount >= relDef.maxCount) {
                errors.push({
                    code: 'MAX_CARDINALITY_EXCEEDED',
                    message: `Maximum ${relDef.maxCount} ${relDef.label} relationship(s) allowed. Current: ${existingCount}`,
                    entityId: sourceId,
                });
            }
        }

        // Check for cycles (if schema disallows them)
        if (!schema.allowCycles) {
            const wouldCreateCycle = await this.detectCycle(
                existingRels,
                sourceId,
                targetId,
                relationshipCode,
                relDef.inverseRelationship
            );

            if (wouldCreateCycle) {
                errors.push({
                    code: 'CYCLE_DETECTED',
                    message: 'Adding this relationship would create a circular reference',
                    entityId: sourceId,
                });
            }
        }

        // Entity membership check
        if (!network.entityIds.includes(sourceId)) {
            warnings.push({
                code: 'SOURCE_NOT_MEMBER',
                message: 'Source entity is not a member of this network. It will be added automatically.',
                entityId: sourceId,
                suggestion: 'Entity will be added to network on relationship creation',
            });
        }

        if (!network.entityIds.includes(targetId)) {
            warnings.push({
                code: 'TARGET_NOT_MEMBER',
                message: 'Target entity is not a member of this network. It will be added automatically.',
                entityId: targetId,
                suggestion: 'Entity will be added to network on relationship creation',
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Detect if adding an edge would create a cycle
     */
    private async detectCycle(
        existingRels: NetworkRelationshipInstance[],
        newSource: NodeId,
        newTarget: NodeId,
        relationshipCode: string,
        inverseCode?: string
    ): Promise<boolean> {
        // BFS to check if path exists from newTarget back to newSource
        // following the same relationship type (or its inverse)
        const relevantCodes = new Set([relationshipCode]);
        if (inverseCode) {
            relevantCodes.add(inverseCode);
        }

        const visited = new Set<NodeId>();
        const queue: NodeId[] = [newTarget];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current === newSource) return true;
            if (visited.has(current)) continue;

            visited.add(current);

            // Find outbound edges of same type
            const outbound = existingRels
                .filter(r =>
                    relevantCodes.has(r.relationshipCode) &&
                    r.sourceEntityId === current
                )
                .map(r => r.targetEntityId);

            queue.push(...outbound);
        }

        return false;
    }

    /**
     * Validate entire network for consistency
     */
    async validateNetwork(
        network: NetworkInstance,
        schema: NetworkSchema
    ): Promise<NetworkValidationResult> {
        const errors: NetworkValidationError[] = [];
        const warnings: NetworkValidationWarning[] = [];

        const relationships = await loadNetworkRelationships(network.id);

        // Check root node requirement
        if (schema.requireRootNode && !network.rootEntityId) {
            errors.push({
                code: 'MISSING_ROOT_NODE',
                message: `Network "${network.name}" requires a root entity`,
            });
        }

        // Check all relationship cardinalities
        for (const relDef of schema.relationships) {
            if (relDef.maxCount !== undefined) {
                for (const entityId of network.entityIds) {
                    const count = relationships.filter(r =>
                        r.relationshipCode === relDef.code &&
                        r.sourceEntityId === entityId
                    ).length;

                    if (count > relDef.maxCount) {
                        errors.push({
                            code: 'CARDINALITY_VIOLATION',
                            message: `Entity has ${count} ${relDef.label} relationships (max: ${relDef.maxCount})`,
                            entityId,
                        });
                    }
                }
            }

            // Check minCount if specified
            if (relDef.minCount !== undefined && relDef.minCount > 0) {
                for (const entityId of network.entityIds) {
                    const count = relationships.filter(r =>
                        r.relationshipCode === relDef.code &&
                        r.sourceEntityId === entityId
                    ).length;

                    if (count < relDef.minCount) {
                        warnings.push({
                            code: 'MIN_CARDINALITY_WARNING',
                            message: `Entity has ${count} ${relDef.label} relationships (recommended min: ${relDef.minCount})`,
                            entityId,
                        });
                    }
                }
            }
        }

        // Check for orphan relationships (referencing non-member entities)
        for (const rel of relationships) {
            if (!network.entityIds.includes(rel.sourceEntityId)) {
                errors.push({
                    code: 'ORPHAN_RELATIONSHIP_SOURCE',
                    message: `Relationship references source entity not in network`,
                    relationshipId: rel.id,
                    entityId: rel.sourceEntityId,
                });
            }
            if (!network.entityIds.includes(rel.targetEntityId)) {
                errors.push({
                    code: 'ORPHAN_RELATIONSHIP_TARGET',
                    message: `Relationship references target entity not in network`,
                    relationshipId: rel.id,
                    entityId: rel.targetEntityId,
                });
            }
        }

        // Check for cycles if not allowed
        if (!schema.allowCycles) {
            const cycleDetected = await this.detectAnyCycle(relationships, network);
            if (cycleDetected) {
                errors.push({
                    code: 'CYCLE_EXISTS',
                    message: 'Network contains circular relationships which are not allowed by schema',
                });
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Detect any cycle in the network
     */
    private async detectAnyCycle(
        relationships: NetworkRelationshipInstance[],
        network: NetworkInstance
    ): Promise<boolean> {
        const visited = new Set<NodeId>();
        const recStack = new Set<NodeId>();

        const hasCycleDFS = (nodeId: NodeId): boolean => {
            if (recStack.has(nodeId)) return true;
            if (visited.has(nodeId)) return false;

            visited.add(nodeId);
            recStack.add(nodeId);

            const outbound = relationships
                .filter(r => r.sourceEntityId === nodeId)
                .map(r => r.targetEntityId);

            for (const child of outbound) {
                if (hasCycleDFS(child)) return true;
            }

            recStack.delete(nodeId);
            return false;
        };

        for (const entityId of network.entityIds) {
            if (hasCycleDFS(entityId)) return true;
        }

        return false;
    }

    /**
     * Validate entity can be added to network
     */
    validateEntityAddition(
        network: NetworkInstance,
        schema: NetworkSchema,
        entityKind: string
    ): NetworkValidationResult {
        const errors: NetworkValidationError[] = [];
        const warnings: NetworkValidationWarning[] = [];

        if (!schema.allowedEntityKinds.includes(entityKind as any)) {
            errors.push({
                code: 'INVALID_ENTITY_KIND',
                message: `Entity kind "${entityKind}" is not allowed in ${schema.name} networks. Allowed: ${schema.allowedEntityKinds.join(', ')}`,
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validate relationship definition
     */
    validateRelationshipDef(relDef: NetworkRelationshipDef): NetworkValidationResult {
        const errors: NetworkValidationError[] = [];
        const warnings: NetworkValidationWarning[] = [];

        if (!relDef.code || relDef.code.length === 0) {
            errors.push({
                code: 'MISSING_RELATIONSHIP_CODE',
                message: 'Relationship must have a code',
            });
        }

        if (!relDef.label || relDef.label.length === 0) {
            errors.push({
                code: 'MISSING_RELATIONSHIP_LABEL',
                message: 'Relationship must have a label',
            });
        }

        if (relDef.maxCount !== undefined && relDef.minCount !== undefined) {
            if (relDef.maxCount < relDef.minCount) {
                errors.push({
                    code: 'INVALID_CARDINALITY',
                    message: `maxCount (${relDef.maxCount}) cannot be less than minCount (${relDef.minCount})`,
                });
            }
        }

        if (relDef.direction === 'BIDIRECTIONAL' && relDef.inverseRelationship !== relDef.code) {
            warnings.push({
                code: 'BIDIRECTIONAL_INVERSE_MISMATCH',
                message: 'Bidirectional relationships usually have themselves as inverse',
                suggestion: `Set inverseRelationship to "${relDef.code}"`,
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validate schema definition
     */
    validateSchema(schema: Partial<NetworkSchema>): NetworkValidationResult {
        const errors: NetworkValidationError[] = [];
        const warnings: NetworkValidationWarning[] = [];

        if (!schema.id) {
            errors.push({
                code: 'MISSING_SCHEMA_ID',
                message: 'Schema must have an ID',
            });
        }

        if (!schema.name) {
            errors.push({
                code: 'MISSING_SCHEMA_NAME',
                message: 'Schema must have a name',
            });
        }

        if (!schema.relationships || schema.relationships.length === 0) {
            warnings.push({
                code: 'NO_RELATIONSHIPS_DEFINED',
                message: 'Schema has no relationship definitions',
                suggestion: 'Add at least one relationship type',
            });
        }

        // Validate each relationship definition
        if (schema.relationships) {
            for (const relDef of schema.relationships) {
                const relValidation = this.validateRelationshipDef(relDef);
                errors.push(...relValidation.errors);
                warnings.push(...relValidation.warnings);

                // Check inverse relationship exists
                if (relDef.inverseRelationship) {
                    const inverseExists = schema.relationships.some(r => r.code === relDef.inverseRelationship);
                    if (!inverseExists) {
                        warnings.push({
                            code: 'MISSING_INVERSE_RELATIONSHIP',
                            message: `Inverse relationship "${relDef.inverseRelationship}" not found for "${relDef.code}"`,
                            suggestion: 'Add the inverse relationship definition',
                        });
                    }
                }
            }

            // Check for duplicate codes
            const codes = schema.relationships.map(r => r.code);
            const duplicates = codes.filter((code, idx) => codes.indexOf(code) !== idx);
            if (duplicates.length > 0) {
                errors.push({
                    code: 'DUPLICATE_RELATIONSHIP_CODES',
                    message: `Duplicate relationship codes: ${[...new Set(duplicates)].join(', ')}`,
                });
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
}

// Export singleton instance
export const networkValidator = new NetworkValidator();

export default networkValidator;
