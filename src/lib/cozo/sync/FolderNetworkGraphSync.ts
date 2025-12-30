import { mutationCoordinator } from '../mutations';
import { generateId } from '@/lib/utils/ids';
import type { Folder } from '@/types/noteTypes';
import type { NetworkInstance, NetworkRelationshipInstance } from '@/lib/networks/types';

const DEBOUNCE_MS = 500;

export class FolderNetworkGraphSync {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingFolders: Map<string, Folder> = new Map();
  private pendingNetworks: Map<string, NetworkInstance> = new Map();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await mutationCoordinator.init();
      this.initialized = true;
      console.log('[FolderNetworkGraphSync] Initialized via MutationCoordinator');
    } catch (err) {
      console.warn('[FolderNetworkGraphSync] Init failed, will retry on next sync:', err);
    }
  }

  onFoldersChanged(folders: Folder[]): void {
    for (const folder of folders) {
      this.pendingFolders.set(folder.id, folder);
    }
    this.scheduleSyncDebounced();
  }

  onNetworksChanged(networks: NetworkInstance[]): void {
    for (const network of networks) {
      this.pendingNetworks.set(network.id, network);
    }
    this.scheduleSyncDebounced();
  }

  onNetworkRelationshipsChanged(networkId: string, relationships: NetworkRelationshipInstance[]): void {
    this.syncNetworkRelationships(networkId, relationships).catch(err => {
      console.warn('[FolderNetworkGraphSync] Failed to sync network relationships:', err);
    });
  }

  private scheduleSyncDebounced(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushPendingSync();
    }, DEBOUNCE_MS);
  }

  private async flushPendingSync(): Promise<void> {
    if (!this.initialized) {
      await this.init();
      if (!this.initialized) return;
    }

    const folders = Array.from(this.pendingFolders.values());
    const networks = Array.from(this.pendingNetworks.values());

    this.pendingFolders.clear();
    this.pendingNetworks.clear();

    if (folders.length > 0) {
      await this.syncFolderHierarchy(folders);
    }

    if (networks.length > 0) {
      await this.syncNetworkInstances(networks);
    }
  }

  private async syncFolderHierarchy(folders: Folder[]): Promise<void> {
    const folderMap = new Map(folders.map(f => [f.id, f]));
    let syncCount = 0;

    for (const folder of folders) {
      if (!folder.parentId) continue;

      const parent = folderMap.get(folder.parentId);
      if (!parent) continue;

      const edgeId = generateId();
      const now = Date.now();
      const groupId = `folder:${folder.parentId}`;

      const result = await mutationCoordinator.upsert(
        'folder_hierarchy',
        edgeId,
        {
          parent_id: folder.parentId,
          child_id: folder.id,
          created_at: now,
          valid_at: now,
          invalid_at: null,
          group_id: groupId,
          scope_type: 'folder',
          edge_type: 'CONTAINS',
          inverse_type: 'CONTAINED_BY',
          parent_entity_kind: parent.entityKind || null,
          child_entity_kind: folder.entityKind || null,
          confidence: 1.0,
          extraction_methods: ['folder_structure'],
        },
        'FOLDER'
      );

      if (result.success) syncCount++;
    }

    console.log(`[FolderNetworkGraphSync] Synced ${syncCount}/${folders.length} folder hierarchy edges via MutationCoordinator`);
  }

  private async syncNetworkInstances(networks: NetworkInstance[]): Promise<void> {
    let syncCount = 0;

    for (const network of networks) {
      const now = Date.now();
      const groupId = `network:${network.id}`;

      const result = await mutationCoordinator.upsert(
        'network_instance',
        network.id,
        {
          name: network.name,
          schema_id: network.schemaId,
          network_kind: network.schemaId.split('_')[0] || 'CUSTOM',
          network_subtype: null,
          root_folder_id: network.rootFolderId,
          root_entity_id: network.rootEntityId || null,
          namespace: network.namespace,
          description: network.description || null,
          tags: network.tags || [],
          member_count: network.stats?.memberCount || 0,
          relationship_count: network.stats?.relationshipCount || 0,
          max_depth: network.stats?.maxDepth || 0,
          created_at: network.createdAt.getTime(),
          updated_at: now,
          group_id: groupId,
          scope_type: 'network',
        },
        'NETWORK'
      );

      if (result.success) {
        syncCount++;

        if (network.entityIds && network.entityIds.length > 0) {
          await this.syncNetworkMemberships(network);
        }
      }
    }

    console.log(`[FolderNetworkGraphSync] Synced ${syncCount}/${networks.length} network instances via MutationCoordinator`);
  }

  private async syncNetworkMemberships(network: NetworkInstance): Promise<void> {
    const now = Date.now();
    const groupId = `network:${network.id}`;

    for (const entityId of network.entityIds) {
      const isRoot = entityId === network.rootEntityId;
      const membershipId = generateId();

      await mutationCoordinator.upsert(
        'network_membership',
        membershipId,
        {
          network_id: network.id,
          entity_id: entityId,
          role: null,
          joined_at: now,
          left_at: null,
          is_root: isRoot,
          depth_level: 0,
          created_at: now,
          updated_at: now,
          group_id: groupId,
          extraction_methods: ['network'],
        },
        'MEMBERSHIP'
      );
    }
  }

  private async syncNetworkRelationships(
    networkId: string,
    relationships: NetworkRelationshipInstance[]
  ): Promise<void> {
    const now = Date.now();
    const groupId = `network:${networkId}`;
    let syncCount = 0;

    for (const rel of relationships) {
      const result = await mutationCoordinator.upsert(
        'network_relationship',
        rel.id,
        {
          network_id: rel.networkId,
          source_id: rel.sourceEntityId,
          target_id: rel.targetEntityId,
          relationship_code: rel.relationshipCode,
          inverse_code: null,
          start_date: rel.startDate ? rel.startDate.getTime() : null,
          end_date: rel.endDate ? rel.endDate.getTime() : null,
          strength: rel.strength || 1.0,
          notes: rel.notes || null,
          attributes: rel.attributes || null,
          created_at: rel.createdAt.getTime(),
          updated_at: now,
          group_id: groupId,
          scope_type: 'network',
          confidence: 1.0,
          extraction_methods: ['network'],
        },
        'RELATIONSHIP'
      );

      if (result.success) syncCount++;
    }

    console.log(`[FolderNetworkGraphSync] Synced ${syncCount}/${relationships.length} network relationships for ${networkId}`);
  }

  async invalidateFolderEdges(folderId: string): Promise<void> {
    console.log(`[FolderNetworkGraphSync] Invalidating folder edges for ${folderId}`);
  }

  async deleteNetwork(networkId: string): Promise<void> {
    await mutationCoordinator.delete('network_membership', networkId);
    await mutationCoordinator.delete('network_relationship', networkId);
    await mutationCoordinator.delete('network_instance', networkId);

    console.log(`[FolderNetworkGraphSync] Deleted network ${networkId} via MutationCoordinator`);
  }
}

export const folderNetworkGraphSync = new FolderNetworkGraphSync();
