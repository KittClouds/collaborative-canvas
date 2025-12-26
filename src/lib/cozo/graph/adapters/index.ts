/**
 * Adapter exports - drop-in replacements for old registries
 */

export { entityRegistry, type RegisteredEntity, type EntityRegistrationResult } from './EntityRegistryAdapter';
export { relationshipRegistry, type UnifiedRelationship, type RelationshipInput, RelationshipSource } from './RelationshipRegistryAdapter';
export { unifiedRegistry } from '../UnifiedRegistry';
