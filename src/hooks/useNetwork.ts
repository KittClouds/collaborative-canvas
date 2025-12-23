/**
 * useNetwork Hook
 * 
 * React hook for managing network instances, schemas, and relationships.
 * Provides a clean API for UI components to interact with networks.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { generateId } from '@/lib/utils/ids';
import type { NodeId } from '@/lib/graph/types';
import type { EntityKind } from '@/lib/entities/entityTypes';
import type { Folder, Note } from '@/contexts/NotesContext';
import {
    NetworkSchema,
    NetworkInstance,
    NetworkRelationshipInstance,
    NetworkRelationshipDef,
    NetworkKind,
    NetworkValidationResult,
    getRelationshipDef,
    getInverseRelationshipCode,
    NETWORK_COLORS,
} from '@/lib/networks/types';
import {
    BUILTIN_SCHEMAS,
    getDefaultSchemaForKind,
    getSchemaById,
} from '@/lib/networks/schemas';
import {
    saveNetworkInstance,
    loadNetworkInstance,
    loadNetworkByFolderId,
    loadAllNetworks,
    deleteNetworkInstance,
    updateNetworkInstance,
    saveNetworkRelationship,
    loadNetworkRelationships,
    deleteNetworkRelationship,
    addEntityToNetwork,
    removeEntityFromNetwork,
    loadNetworkSchema,
    saveNetworkSchema,
    loadAllCustomSchemas,
    updateNetworkStats,
} from '@/lib/networks/storage';
import { networkValidator } from '@/lib/networks/validator';
import {
    getAncestors,
    getDescendants,
    getSiblings,
    getSpouses,
    getFamilyUnit,
    getGenerationDepth,
} from '@/lib/networks/queries';

interface UseNetworkOptions {
    folderId?: string;
    networkId?: string;
}

interface UseNetworkReturn {
    // State
    network: NetworkInstance | null;
    schema: NetworkSchema | null;
    relationships: NetworkRelationshipInstance[];
    isLoading: boolean;
    error: string | null;

    // All available schemas
    availableSchemas: NetworkSchema[];

    // Network CRUD
    createNetwork: (
        name: string,
        schemaId: string,
        rootFolderId: string,
        options?: { rootEntityId?: string; namespace?: string; description?: string }
    ) => Promise<NetworkInstance>;
    updateNetwork: (updates: Partial<NetworkInstance>) => Promise<void>;
    deleteNetwork: () => Promise<void>;
    refreshNetwork: () => Promise<void>;

    // Relationship operations
    addRelationship: (
        relationshipCode: string,
        sourceEntityId: NodeId,
        targetEntityId: NodeId,
        options?: { startDate?: Date; notes?: string; strength?: number }
    ) => Promise<NetworkValidationResult & { relationshipId?: string }>;
    removeRelationship: (relationshipId: string) => Promise<void>;

    // Member operations
    addMember: (entityId: NodeId) => Promise<void>;
    removeMember: (entityId: NodeId) => Promise<void>;

    // Query helpers
    getAvailableRelationships: (entityKind?: EntityKind) => NetworkRelationshipDef[];
    getEntityRelationships: (entityId: NodeId) => NetworkRelationshipInstance[];

    // Family-specific helpers
    getFamily: (entityId: NodeId) => Promise<{
        parents: NodeId[];
        children: NodeId[];
        spouses: NodeId[];
        siblings: NodeId[];
    }>;
    getLineage: (entityId: NodeId, direction: 'ancestors' | 'descendants') => Promise<NodeId[]>;
}

/**
 * Hook for managing a network instance
 */
export function useNetwork(options: UseNetworkOptions = {}): UseNetworkReturn {
    const { folderId, networkId: providedNetworkId } = options;

    const [network, setNetwork] = useState<NetworkInstance | null>(null);
    const [schema, setSchema] = useState<NetworkSchema | null>(null);
    const [relationships, setRelationships] = useState<NetworkRelationshipInstance[]>([]);
    const [customSchemas, setCustomSchemas] = useState<NetworkSchema[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // All available schemas (built-in + custom)
    const availableSchemas = useMemo(() => {
        return [...BUILTIN_SCHEMAS, ...customSchemas];
    }, [customSchemas]);

    // Load network by folder ID or network ID
    const refreshNetwork = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            let loadedNetwork: NetworkInstance | null = null;

            if (providedNetworkId) {
                loadedNetwork = await loadNetworkInstance(providedNetworkId);
            } else if (folderId) {
                loadedNetwork = await loadNetworkByFolderId(folderId);
            }

            if (loadedNetwork) {
                setNetwork(loadedNetwork);

                // Load schema
                let loadedSchema = getSchemaById(loadedNetwork.schemaId);
                if (!loadedSchema) {
                    loadedSchema = await loadNetworkSchema(loadedNetwork.schemaId);
                }
                setSchema(loadedSchema || null);

                // Load relationships
                const rels = await loadNetworkRelationships(loadedNetwork.id);
                setRelationships(rels);
            } else {
                setNetwork(null);
                setSchema(null);
                setRelationships([]);
            }

            // Load custom schemas
            const customs = await loadAllCustomSchemas();
            setCustomSchemas(customs);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load network');
        } finally {
            setIsLoading(false);
        }
    }, [providedNetworkId, folderId]);

    // Initial load
    useEffect(() => {
        refreshNetwork();
    }, [refreshNetwork]);

    // Create a new network
    const createNetwork = useCallback(async (
        name: string,
        schemaId: string,
        rootFolderId: string,
        options?: { rootEntityId?: string; namespace?: string; description?: string }
    ): Promise<NetworkInstance> => {
        const newNetwork: NetworkInstance = {
            id: generateId(),
            name,
            schemaId,
            rootFolderId,
            rootEntityId: options?.rootEntityId,
            entityIds: options?.rootEntityId ? [options.rootEntityId] : [],
            namespace: options?.namespace || 'default',
            description: options?.description,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await saveNetworkInstance(newNetwork);
        setNetwork(newNetwork);

        // Load schema
        let loadedSchema = getSchemaById(schemaId);
        if (!loadedSchema) {
            loadedSchema = await loadNetworkSchema(schemaId);
        }
        setSchema(loadedSchema || null);

        return newNetwork;
    }, []);

    // Update network
    const updateNetworkFn = useCallback(async (updates: Partial<NetworkInstance>) => {
        if (!network) return;

        const updated = await updateNetworkInstance(network.id, updates);
        if (updated) {
            setNetwork(updated);
        }
    }, [network]);

    // Delete network
    const deleteNetwork = useCallback(async () => {
        if (!network) return;

        await deleteNetworkInstance(network.id);
        setNetwork(null);
        setSchema(null);
        setRelationships([]);
    }, [network]);

    // Add relationship
    const addRelationship = useCallback(async (
        relationshipCode: string,
        sourceEntityId: NodeId,
        targetEntityId: NodeId,
        options?: { startDate?: Date; notes?: string; strength?: number }
    ): Promise<NetworkValidationResult & { relationshipId?: string }> => {
        if (!network || !schema) {
            return {
                valid: false,
                errors: [{ code: 'NO_NETWORK', message: 'No network loaded' }],
                warnings: [],
            };
        }

        // Validate
        const validation = await networkValidator.validateAddRelationship(
            network,
            schema,
            relationshipCode,
            sourceEntityId,
            targetEntityId
        );

        if (!validation.valid) {
            return validation;
        }

        // Create relationship
        const newRel: NetworkRelationshipInstance = {
            id: generateId(),
            networkId: network.id,
            relationshipCode,
            sourceEntityId,
            targetEntityId,
            startDate: options?.startDate,
            notes: options?.notes,
            strength: options?.strength,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await saveNetworkRelationship(newRel);

        // Add entities to network if not already members
        if (!network.entityIds.includes(sourceEntityId)) {
            await addEntityToNetwork(network.id, sourceEntityId);
        }
        if (!network.entityIds.includes(targetEntityId)) {
            await addEntityToNetwork(network.id, targetEntityId);
        }

        // Auto-create inverse relationship if schema specifies
        if (schema.autoCreateInverse) {
            const inverseCode = getInverseRelationshipCode(schema, relationshipCode);
            if (inverseCode && inverseCode !== relationshipCode) {
                const inverseRel: NetworkRelationshipInstance = {
                    id: generateId(),
                    networkId: network.id,
                    relationshipCode: inverseCode,
                    sourceEntityId: targetEntityId,
                    targetEntityId: sourceEntityId,
                    startDate: options?.startDate,
                    notes: options?.notes,
                    strength: options?.strength,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                await saveNetworkRelationship(inverseRel);
            }
        }

        // Update stats
        await updateNetworkStats(network.id);

        // Refresh relationships
        const rels = await loadNetworkRelationships(network.id);
        setRelationships(rels);

        // Refresh network (for entityIds)
        const refreshed = await loadNetworkInstance(network.id);
        if (refreshed) setNetwork(refreshed);

        return { ...validation, relationshipId: newRel.id };
    }, [network, schema]);

    // Remove relationship
    const removeRelationship = useCallback(async (relationshipId: string) => {
        if (!network) return;

        await deleteNetworkRelationship(relationshipId);

        // Refresh
        const rels = await loadNetworkRelationships(network.id);
        setRelationships(rels);

        await updateNetworkStats(network.id);
    }, [network]);

    // Add member
    const addMember = useCallback(async (entityId: NodeId) => {
        if (!network) return;

        await addEntityToNetwork(network.id, entityId);

        const refreshed = await loadNetworkInstance(network.id);
        if (refreshed) setNetwork(refreshed);
    }, [network]);

    // Remove member
    const removeMember = useCallback(async (entityId: NodeId) => {
        if (!network) return;

        await removeEntityFromNetwork(network.id, entityId);

        // Refresh
        const refreshed = await loadNetworkInstance(network.id);
        if (refreshed) setNetwork(refreshed);

        const rels = await loadNetworkRelationships(network.id);
        setRelationships(rels);
    }, [network]);

    // Get available relationships (optionally filtered by entity kind)
    const getAvailableRelationships = useCallback((entityKind?: EntityKind): NetworkRelationshipDef[] => {
        if (!schema) return [];

        if (!entityKind) {
            return schema.relationships;
        }

        return schema.relationships.filter(
            r => r.sourceKind === entityKind
        );
    }, [schema]);

    // Get relationships for a specific entity
    const getEntityRelationships = useCallback((entityId: NodeId): NetworkRelationshipInstance[] => {
        return relationships.filter(
            r => r.sourceEntityId === entityId || r.targetEntityId === entityId
        );
    }, [relationships]);

    // Get family (parents, children, spouses, siblings)
    const getFamily = useCallback(async (entityId: NodeId) => {
        if (!network) {
            return { parents: [], children: [], spouses: [], siblings: [] };
        }

        const [familyUnit, sibs] = await Promise.all([
            getFamilyUnit(network.id, entityId),
            getSiblings(network.id, entityId),
        ]);

        return {
            parents: familyUnit.parents,
            children: familyUnit.children,
            spouses: familyUnit.spouses,
            siblings: sibs,
        };
    }, [network]);

    // Get lineage (ancestors or descendants)
    const getLineage = useCallback(async (
        entityId: NodeId,
        direction: 'ancestors' | 'descendants'
    ): Promise<NodeId[]> => {
        if (!network) return [];

        const results = direction === 'ancestors'
            ? await getAncestors({ networkId: network.id, startEntityId: entityId })
            : await getDescendants({ networkId: network.id, startEntityId: entityId });

        return results.map(r => r.entityId);
    }, [network]);

    return {
        network,
        schema,
        relationships,
        isLoading,
        error,
        availableSchemas,
        createNetwork,
        updateNetwork: updateNetworkFn,
        deleteNetwork,
        refreshNetwork,
        addRelationship,
        removeRelationship,
        addMember,
        removeMember,
        getAvailableRelationships,
        getEntityRelationships,
        getFamily,
        getLineage,
    };
}

/**
 * Hook to get all networks
 */
export function useAllNetworks() {
    const [networks, setNetworks] = useState<NetworkInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        const all = await loadAllNetworks();
        setNetworks(all);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { networks, isLoading, refresh };
}

/**
 * Helper to create a network-typed folder name
 */
export function createNetworkFolderName(networkKind: NetworkKind, name: string): string {
    return `[NETWORK:${networkKind}|${name}]`;
}

/**
 * Helper to get network kind from folder name
 */
export function parseNetworkFromFolderName(folderName: string): {
    isNetwork: boolean;
    networkKind?: NetworkKind;
    name?: string;
} {
    const match = folderName.match(/^\[NETWORK:([A-Z_]+)\|(.+)\]$/);
    if (match) {
        return {
            isNetwork: true,
            networkKind: match[1] as NetworkKind,
            name: match[2],
        };
    }
    return { isNetwork: false };
}

export default useNetwork;
