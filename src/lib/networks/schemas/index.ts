/**
 * Network Schemas Index
 * 
 * Exports all built-in network schemas and provides utilities
 * for schema management.
 */

// Schema exports
export { FAMILY_SCHEMA, FAMILY_RELATIONSHIPS } from './familySchema';
export { ORG_SCHEMA, ORG_RELATIONSHIPS, MILITARY_ORG_SCHEMA, CORPORATE_ORG_SCHEMA } from './organizationSchema';
export { FACTION_SCHEMA, FACTION_RELATIONSHIPS } from './factionSchema';
export { ALLIANCE_SCHEMA, ALLIANCE_RELATIONSHIPS } from './allianceSchema';
export { GUILD_SCHEMA, GUILD_RELATIONSHIPS } from './guildSchema';

// Schema utilities
export * from './familySchema';
export * from './organizationSchema';

import type { NetworkSchema, NetworkKind } from '../types';
import { FAMILY_SCHEMA } from './familySchema';
import { ORG_SCHEMA, MILITARY_ORG_SCHEMA, CORPORATE_ORG_SCHEMA } from './organizationSchema';
import { FACTION_SCHEMA } from './factionSchema';
import { ALLIANCE_SCHEMA } from './allianceSchema';
import { GUILD_SCHEMA } from './guildSchema';

/**
 * All built-in schemas
 */
export const BUILTIN_SCHEMAS: NetworkSchema[] = [
    FAMILY_SCHEMA,
    ORG_SCHEMA,
    MILITARY_ORG_SCHEMA,
    CORPORATE_ORG_SCHEMA,
    FACTION_SCHEMA,
    ALLIANCE_SCHEMA,
    GUILD_SCHEMA,
];

/**
 * Default schema for each network kind
 */
export const DEFAULT_SCHEMA_BY_KIND: Record<NetworkKind, NetworkSchema | undefined> = {
    FAMILY: FAMILY_SCHEMA,
    ORGANIZATION: ORG_SCHEMA,
    FACTION: FACTION_SCHEMA,
    ALLIANCE: ALLIANCE_SCHEMA,
    GUILD: GUILD_SCHEMA,
    FRIENDSHIP: undefined, // Custom only
    RIVALRY: undefined, // Custom only
    CUSTOM: undefined, // Custom only
};

/**
 * Get the default schema for a network kind
 */
export function getDefaultSchemaForKind(kind: NetworkKind): NetworkSchema | undefined {
    return DEFAULT_SCHEMA_BY_KIND[kind];
}

/**
 * Get all schemas of a specific kind
 */
export function getSchemasForKind(kind: NetworkKind): NetworkSchema[] {
    return BUILTIN_SCHEMAS.filter(s => s.kind === kind);
}

/**
 * Get a schema by its ID
 */
export function getSchemaById(id: string): NetworkSchema | undefined {
    return BUILTIN_SCHEMAS.find(s => s.id === id);
}

/**
 * Get all system schemas (built-in)
 */
export function getSystemSchemas(): NetworkSchema[] {
    return BUILTIN_SCHEMAS.filter(s => s.isSystem);
}

/**
 * Validate a schema has all required fields
 */
export function isValidSchema(schema: Partial<NetworkSchema>): schema is NetworkSchema {
    return (
        typeof schema.id === 'string' &&
        typeof schema.name === 'string' &&
        typeof schema.kind === 'string' &&
        typeof schema.description === 'string' &&
        Array.isArray(schema.allowedEntityKinds) &&
        Array.isArray(schema.relationships) &&
        typeof schema.isHierarchical === 'boolean' &&
        typeof schema.allowCycles === 'boolean' &&
        typeof schema.requireRootNode === 'boolean'
    );
}

/**
 * Create a custom schema template
 */
export function createCustomSchemaTemplate(
    name: string,
    kind: NetworkKind = 'CUSTOM',
    description: string = ''
): Omit<NetworkSchema, 'id' | 'createdAt' | 'updatedAt'> {
    return {
        name,
        kind,
        description,
        allowedEntityKinds: ['CHARACTER'],
        relationships: [],
        isHierarchical: true,
        allowCycles: false,
        requireRootNode: true,
        isSystem: false,
        autoCreateInverse: true,
    };
}
