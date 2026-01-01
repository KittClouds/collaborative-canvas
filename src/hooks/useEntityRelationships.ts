/**
 * useEntityRelationships Hook
 * 
 * React hook for managing entity relationships in Fact Sheets.
 * Connects to RelationshipBridgeStore for unified relationship operations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { EntityKind } from '@/lib/types/entityTypes';
import type { ParsedEntity } from '@/types/factSheetTypes';
import { RelationshipSource } from '@/lib/relationships/types';
import type {
    ResolvedRelationshipInstance,
    GroupedRelationships,
    ApplicableRelationshipType,
    CandidateEntity,
    RelationshipInstanceInput,
    RelationshipInstanceUpdate,
} from '@/lib/relationships/relationshipBridgeTypes';
import { relationshipBridgeStore } from '@/lib/relationships/RelationshipBridgeStore';

interface UseEntityRelationshipsResult {
    /** All relationships for the entity */
    relationships: ResolvedRelationshipInstance[];

    /** Relationships grouped by type (for display) */
    groupedRelationships: GroupedRelationships[];

    /** Applicable relationship types for this entity's kind */
    applicableTypes: ApplicableRelationshipType[];

    /** Loading state */
    isLoading: boolean;

    /** Error state */
    error: string | null;

    /** Create a new relationship */
    createRelationship: (input: CreateRelationshipInput) => Promise<ResolvedRelationshipInstance | null>;

    /** Update a relationship */
    updateRelationship: (relationshipId: string, updates: RelationshipInstanceUpdate) => Promise<ResolvedRelationshipInstance | null>;

    /** Delete a relationship */
    deleteRelationship: (relationshipId: string) => Promise<boolean>;

    /** Get candidate target entities for a relationship type */
    getCandidates: (relationshipTypeId: string) => Promise<CandidateEntity[]>;

    /** Refresh relationships */
    refresh: () => Promise<void>;
}

interface CreateRelationshipInput {
    targetEntityId: string;
    relationshipTypeId: string;
    attributes?: Record<string, unknown>;
    networkId?: string;
}

export function useEntityRelationships(
    entity: ParsedEntity | null
): UseEntityRelationshipsResult {
    const [relationships, setRelationships] = useState<ResolvedRelationshipInstance[]>([]);
    const [groupedRelationships, setGroupedRelationships] = useState<GroupedRelationships[]>([]);
    const [applicableTypes, setApplicableTypes] = useState<ApplicableRelationshipType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get entity ID (from noteId or generate from kind+label)
    const entityId = useMemo(() => {
        if (!entity) return null;
        return entity.noteId || `${entity.kind}::${entity.label}`;
    }, [entity]);

    // Load relationships when entity changes
    const loadRelationships = useCallback(async () => {
        if (!entityId || !entity) return;

        setIsLoading(true);
        setError(null);

        try {
            // Initialize bridge store
            await relationshipBridgeStore.initialize();

            // Load grouped relationships
            const grouped = await relationshipBridgeStore.getByEntityGroupedByType(entityId);
            setGroupedRelationships(grouped);

            // Flatten for simple access
            const allRels = grouped.flatMap(g => [...g.outgoing, ...g.incoming]);
            setRelationships(allRels);

            // Load applicable types for this entity kind
            const types = await relationshipBridgeStore.getApplicableTypes(entity.kind);

            // Enrich with instance counts
            const enrichedTypes = await Promise.all(
                types.map(async (t) => ({
                    ...t,
                    instanceCount: await relationshipBridgeStore.getInstanceCount(t.id),
                }))
            );

            setApplicableTypes(enrichedTypes);
        } catch (err) {
            console.error('[useEntityRelationships] Failed to load:', err);
            setError(err instanceof Error ? err.message : 'Failed to load relationships');
        } finally {
            setIsLoading(false);
        }
    }, [entityId, entity]);

    useEffect(() => {
        loadRelationships();
    }, [loadRelationships]);

    // Create relationship
    const createRelationship = useCallback(
        async (input: CreateRelationshipInput): Promise<ResolvedRelationshipInstance | null> => {
            if (!entityId) return null;

            try {
                const fullInput: RelationshipInstanceInput = {
                    sourceEntityId: entityId,
                    targetEntityId: input.targetEntityId,
                    relationshipTypeId: input.relationshipTypeId,
                    source: RelationshipSource.MANUAL,
                    confidence: 1.0,
                    attributes: input.attributes,
                    networkId: input.networkId,
                };

                const created = await relationshipBridgeStore.create(fullInput);

                // Refresh list
                await loadRelationships();

                return created;
            } catch (err) {
                console.error('[useEntityRelationships] Create failed:', err);
                setError(err instanceof Error ? err.message : 'Failed to create relationship');
                return null;
            }
        },
        [entityId, loadRelationships]
    );

    // Delete relationship
    const deleteRelationship = useCallback(
        async (relationshipId: string): Promise<boolean> => {
            try {
                const deleted = await relationshipBridgeStore.delete(relationshipId);

                if (deleted) {
                    // Refresh list
                    await loadRelationships();
                }

                return deleted;
            } catch (err) {
                console.error('[useEntityRelationships] Delete failed:', err);
                setError(err instanceof Error ? err.message : 'Failed to delete relationship');
                return false;
            }
        },
        [loadRelationships]
    );

    // Update relationship
    const updateRelationship = useCallback(
        async (relationshipId: string, updates: RelationshipInstanceUpdate): Promise<ResolvedRelationshipInstance | null> => {
            try {
                const updated = await relationshipBridgeStore.update(relationshipId, updates);

                if (updated) {
                    // Refresh list
                    await loadRelationships();
                }

                return updated;
            } catch (err) {
                console.error('[useEntityRelationships] Update failed:', err);
                setError(err instanceof Error ? err.message : 'Failed to update relationship');
                return null;
            }
        },
        [loadRelationships]
    );

    // Get candidates
    const getCandidates = useCallback(
        async (relationshipTypeId: string): Promise<CandidateEntity[]> => {
            if (!entityId) return [];
            return relationshipBridgeStore.getCandidateTargets(entityId, relationshipTypeId);
        },
        [entityId]
    );

    return {
        relationships,
        groupedRelationships,
        applicableTypes,
        isLoading,
        error,
        createRelationship,
        updateRelationship,
        deleteRelationship,
        getCandidates,
        refresh: loadRelationships,
    };
}

/**
 * Hook to get applicable relationship types for an entity kind
 * Lighter weight than useEntityRelationships if you only need the types
 */
export function useApplicableRelationshipTypes(entityKind: EntityKind | null) {
    const [types, setTypes] = useState<ApplicableRelationshipType[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!entityKind) {
            setTypes([]);
            return;
        }

        let cancelled = false;

        const loadTypes = async () => {
            setIsLoading(true);
            try {
                await relationshipBridgeStore.initialize();
                const applicableTypes = await relationshipBridgeStore.getApplicableTypes(entityKind);
                if (!cancelled) {
                    setTypes(applicableTypes);
                }
            } catch (err) {
                console.error('[useApplicableRelationshipTypes] Failed:', err);
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadTypes();

        return () => {
            cancelled = true;
        };
    }, [entityKind]);

    return { types, isLoading };
}
