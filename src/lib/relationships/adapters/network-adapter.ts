/**
 * Network Adapter
 * 
 * Bridges the Network Editor system with the unified RelationshipRegistry.
 * 
 * Responsibilities:
 * - Import existing NetworkRelationshipInstance to UnifiedRelationship
 * - Sync network relationships bidirectionally with the registry
 * - Handle network folder lifecycle events
 * - Auto-create relationships when entities join network folders
 */

import { relationshipRegistry } from '../relationship-registry';
import { RelationshipSource, type RelationshipInput, type RelationshipProvenance, type UnifiedRelationship } from '../types';
import { generateId } from '@/lib/utils/ids';
import {
    loadNetworkRelationships,
    loadNetworkInstance,
    loadAllNetworks,
    saveNetworkRelationship,
    deleteNetworkRelationship,
    loadEntityRelationships,
    getSchemaById,
    type NetworkRelationshipInstance,
    type NetworkInstance,
    type NetworkSchema,
    type NetworkRelationshipDef,
} from '@/lib/networks';
import type { Folder, Note } from '@/contexts/NotesContext';

export interface NetworkSyncResult {
    imported: number;
    updated: number;
    failed: number;
    networkId: string;
}

export interface NetworkAdapterOptions {
    autoSync?: boolean;
    syncOnStartup?: boolean;
}

const NETWORK_NAMESPACE = 'network';

export class NetworkAdapter {
    private syncListeners: Map<string, () => void> = new Map();
    private autoSync: boolean = true;

    constructor(options: NetworkAdapterOptions = {}) {
        this.autoSync = options.autoSync ?? true;
        
        if (options.syncOnStartup) {
            this.syncAllNetworks().catch(console.error);
        }
    }

    async syncAllNetworks(): Promise<NetworkSyncResult[]> {
        const networks = await loadAllNetworks();
        const results: NetworkSyncResult[] = [];

        for (const network of networks) {
            const result = await this.syncNetwork(network.id);
            results.push(result);
        }

        return results;
    }

    async syncNetwork(networkId: string): Promise<NetworkSyncResult> {
        const result: NetworkSyncResult = {
            imported: 0,
            updated: 0,
            failed: 0,
            networkId,
        };

        try {
            const network = await loadNetworkInstance(networkId);
            if (!network) {
                console.warn(`[NetworkAdapter] Network not found: ${networkId}`);
                return result;
            }

            const schema = getSchemaById(network.schemaId);
            if (!schema) {
                console.warn(`[NetworkAdapter] Schema not found: ${network.schemaId}`);
                return result;
            }

            const networkRelationships = await loadNetworkRelationships(networkId);

            for (const netRel of networkRelationships) {
                try {
                    const relDef = schema.relationships.find(r => r.code === netRel.relationshipCode);
                    const unified = this.convertToUnifiedRelationship(netRel, network, relDef);
                    
                    const existing = relationshipRegistry.findByEntities(
                        netRel.sourceEntityId,
                        netRel.targetEntityId,
                        netRel.relationshipCode
                    );

                    if (existing) {
                        result.updated++;
                    } else {
                        result.imported++;
                    }

                    relationshipRegistry.add(unified);
                } catch (error) {
                    console.error(`[NetworkAdapter] Failed to sync relationship ${netRel.id}:`, error);
                    result.failed++;
                }
            }

            console.log(
                `[NetworkAdapter] Synced network "${network.name}": ` +
                `${result.imported} imported, ${result.updated} updated, ${result.failed} failed`
            );
        } catch (error) {
            console.error(`[NetworkAdapter] Failed to sync network ${networkId}:`, error);
        }

        return result;
    }

    convertToUnifiedRelationship(
        netRel: NetworkRelationshipInstance,
        network: NetworkInstance,
        relDef?: NetworkRelationshipDef
    ): RelationshipInput {
        const provenance: RelationshipProvenance = {
            source: RelationshipSource.NETWORK,
            originId: netRel.networkId,
            timestamp: netRel.createdAt,
            confidence: 1.0,
            context: `Network: ${network.name}`,
            metadata: {
                networkId: netRel.networkId,
                networkRelationshipId: netRel.id,
                relationshipCode: netRel.relationshipCode,
                startDate: netRel.startDate,
                endDate: netRel.endDate,
                strength: netRel.strength,
            },
        };

        const isBidirectional = relDef?.direction === 'BIDIRECTIONAL';

        return {
            sourceEntityId: netRel.sourceEntityId,
            targetEntityId: netRel.targetEntityId,
            type: netRel.relationshipCode,
            inverseType: relDef?.inverseRelationship,
            bidirectional: isBidirectional,
            namespace: NETWORK_NAMESPACE,
            attributes: {
                networkId: netRel.networkId,
                networkRelationshipId: netRel.id,
                startDate: netRel.startDate,
                endDate: netRel.endDate,
                strength: netRel.strength,
                notes: netRel.notes,
                ...netRel.attributes,
            },
            provenance: [provenance],
        };
    }

    async convertFromUnifiedRelationship(
        unified: UnifiedRelationship,
        networkId: string
    ): Promise<NetworkRelationshipInstance> {
        const networkProvenance = unified.provenance.find(
            p => p.source === RelationshipSource.NETWORK
        );

        return {
            id: networkProvenance?.metadata?.networkRelationshipId || generateId(),
            networkId,
            relationshipCode: unified.type,
            sourceEntityId: unified.sourceEntityId,
            targetEntityId: unified.targetEntityId,
            startDate: unified.attributes.startDate,
            endDate: unified.attributes.endDate,
            strength: unified.attributes.strength,
            notes: unified.attributes.notes,
            attributes: unified.attributes,
            createdAt: unified.createdAt,
            updatedAt: unified.updatedAt,
        };
    }

    async onNetworkRelationshipCreated(netRel: NetworkRelationshipInstance): Promise<void> {
        if (!this.autoSync) return;

        try {
            const network = await loadNetworkInstance(netRel.networkId);
            if (!network) return;

            const schema = getSchemaById(network.schemaId);
            const relDef = schema?.relationships.find(r => r.code === netRel.relationshipCode);

            const unified = this.convertToUnifiedRelationship(netRel, network, relDef);
            relationshipRegistry.add(unified);

            console.log(`[NetworkAdapter] Synced new relationship: ${netRel.relationshipCode}`);
        } catch (error) {
            console.error('[NetworkAdapter] Failed to sync new relationship:', error);
        }
    }

    async onNetworkRelationshipUpdated(netRel: NetworkRelationshipInstance): Promise<void> {
        if (!this.autoSync) return;

        await this.onNetworkRelationshipCreated(netRel);
    }

    async onNetworkRelationshipDeleted(
        relationshipId: string,
        networkId: string,
        sourceEntityId: string,
        targetEntityId: string,
        relationshipCode: string
    ): Promise<void> {
        if (!this.autoSync) return;

        try {
            const existing = relationshipRegistry.findByEntities(
                sourceEntityId,
                targetEntityId,
                relationshipCode
            );

            if (existing) {
                const hasOtherProvenance = existing.provenance.some(
                    p => p.source !== RelationshipSource.NETWORK ||
                         p.metadata?.networkRelationshipId !== relationshipId
                );

                if (hasOtherProvenance) {
                    relationshipRegistry.removeProvenance(
                        existing.id,
                        RelationshipSource.NETWORK,
                        networkId
                    );
                } else {
                    relationshipRegistry.remove(existing.id);
                }
            }

            console.log(`[NetworkAdapter] Removed relationship from registry: ${relationshipCode}`);
        } catch (error) {
            console.error('[NetworkAdapter] Failed to remove relationship:', error);
        }
    }

    async onEntityAddedToNetworkFolder(
        folder: Folder,
        entity: Note,
        networkId: string
    ): Promise<void> {
        const network = await loadNetworkInstance(networkId);
        if (!network) return;

        const schema = getSchemaById(network.schemaId);
        if (!schema) return;

        if (schema.requireRootNode && !network.rootEntityId && schema.rootEntityKind === entity.entityKind) {
            console.log(`[NetworkAdapter] Entity "${entity.title}" could be root of network "${network.name}"`);
        }

        if (folder.entityKind === 'NETWORK' && entity.entityKind) {
            const parentFolder = await this.getParentFolder(folder);
            if (parentFolder?.isEntity && parentFolder.entityKind) {
                const defaultRelationship = this.inferRelationshipFromStructure(
                    schema,
                    parentFolder.entityKind as string,
                    entity.entityKind as string
                );

                if (defaultRelationship) {
                    const netRel: NetworkRelationshipInstance = {
                        id: generateId(),
                        networkId,
                        relationshipCode: defaultRelationship.code,
                        sourceEntityId: parentFolder.id,
                        targetEntityId: entity.id,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    };

                    await saveNetworkRelationship(netRel);
                    await this.onNetworkRelationshipCreated(netRel);

                    if (schema.autoCreateInverse && defaultRelationship.inverseRelationship) {
                        const inverseRel: NetworkRelationshipInstance = {
                            id: generateId(),
                            networkId,
                            relationshipCode: defaultRelationship.inverseRelationship,
                            sourceEntityId: entity.id,
                            targetEntityId: parentFolder.id,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        };

                        await saveNetworkRelationship(inverseRel);
                        await this.onNetworkRelationshipCreated(inverseRel);
                    }

                    console.log(
                        `[NetworkAdapter] Auto-created ${defaultRelationship.code} relationship ` +
                        `in network "${network.name}"`
                    );
                }
            }
        }
    }

    async onEntityRemovedFromNetworkFolder(
        entityId: string,
        networkId: string
    ): Promise<void> {
        const relationships = await loadEntityRelationships(entityId, networkId);

        for (const rel of relationships) {
            await deleteNetworkRelationship(rel.id);
            await this.onNetworkRelationshipDeleted(
                rel.id,
                networkId,
                rel.sourceEntityId,
                rel.targetEntityId,
                rel.relationshipCode
            );
        }

        console.log(
            `[NetworkAdapter] Removed ${relationships.length} relationships for entity ${entityId}`
        );
    }

    private inferRelationshipFromStructure(
        schema: NetworkSchema,
        parentKind: string,
        childKind: string
    ): NetworkRelationshipDef | undefined {
        const hierarchical = schema.relationships.filter(r => 
            r.sourceKind === parentKind && 
            r.targetKind === childKind &&
            r.direction !== 'BIDIRECTIONAL'
        );

        if (hierarchical.length > 0) {
            const preferred = hierarchical.find(r => 
                r.code.includes('PARENT') || 
                r.code.includes('MANAGES') ||
                r.code.includes('LEADS')
            );
            return preferred || hierarchical[0];
        }

        return schema.relationships.find(r =>
            r.sourceKind === parentKind && r.targetKind === childKind
        );
    }

    private async getParentFolder(folder: Folder): Promise<Folder | null> {
        return null;
    }

    async syncFromRegistry(networkId: string): Promise<number> {
        const network = await loadNetworkInstance(networkId);
        if (!network) return 0;

        const registryRelationships = relationshipRegistry.query({
            namespace: NETWORK_NAMESPACE,
        });

        const networkRels = registryRelationships.filter(r =>
            r.attributes.networkId === networkId &&
            r.provenance.some(p => p.source !== RelationshipSource.NETWORK)
        );

        let synced = 0;
        for (const unified of networkRels) {
            try {
                const netRel = await this.convertFromUnifiedRelationship(unified, networkId);
                await saveNetworkRelationship(netRel);
                synced++;
            } catch (error) {
                console.error('[NetworkAdapter] Failed to sync relationship to network:', error);
            }
        }

        return synced;
    }

    async getNetworkRelationshipsFromRegistry(networkId: string): Promise<UnifiedRelationship[]> {
        return relationshipRegistry.query({
            namespace: NETWORK_NAMESPACE,
        }).filter(r => r.attributes.networkId === networkId);
    }

    async clearNetworkFromRegistry(networkId: string): Promise<number> {
        const relationships = await this.getNetworkRelationshipsFromRegistry(networkId);
        let removed = 0;

        for (const rel of relationships) {
            try {
                relationshipRegistry.remove(rel.id);
                removed++;
            } catch (error) {
                console.error('[NetworkAdapter] Failed to remove relationship:', error);
            }
        }

        return removed;
    }

    setAutoSync(enabled: boolean): void {
        this.autoSync = enabled;
    }

    isAutoSyncEnabled(): boolean {
        return this.autoSync;
    }
}

let networkAdapterInstance: NetworkAdapter | null = null;

export function getNetworkAdapter(): NetworkAdapter {
    if (!networkAdapterInstance) {
        networkAdapterInstance = new NetworkAdapter({ autoSync: true });
    }
    return networkAdapterInstance;
}

export async function initializeNetworkAdapter(options?: NetworkAdapterOptions): Promise<NetworkAdapter> {
    networkAdapterInstance = new NetworkAdapter(options);
    return networkAdapterInstance;
}
