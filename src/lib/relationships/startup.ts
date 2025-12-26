import { RelationshipStoreImpl } from '@/lib/storage/impl/RelationshipStoreImpl';
import { relationshipRegistry } from '@/lib/cozo/graph/adapters';

// Legacy compatibility stubs
let relationshipStore: RelationshipStoreImpl | null = null;

export function setRelationshipStore(store: RelationshipStoreImpl) {
    relationshipStore = store;
    // No-op for Cozo adapter as it handles persistence internally
    console.log('[RelationshipSystem] setRelationshipStore called (legacy compatibility)');
}

export function getRelationshipStore(): RelationshipStoreImpl | null {
    return relationshipStore;
}

export async function initializeRelationshipSystem(): Promise<{ loaded: number }> {
    try {
        await relationshipRegistry.init();
        const stats = await relationshipRegistry.getStats();
        console.log(`[RelationshipSystem] Initialized Cozo-backed registry. Total relationships: ${stats.total}`);
        return { loaded: stats.total };
    } catch (error) {
        console.error("Failed to initialize relationship system:", error);
        return { loaded: 0 };
    }
}
