/**
 * Relationship Adapters Index
 * 
 * Adapters bridge external relationship systems with the unified RelationshipRegistry.
 */

export {
    NetworkAdapter,
    getNetworkAdapter,
    initializeNetworkAdapter,
    type NetworkSyncResult,
    type NetworkAdapterOptions,
} from './network-adapter';
