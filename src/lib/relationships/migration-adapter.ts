/**
 * RelationshipMigrationAdapter - Migration utilities for relationship data
 * 
 * Provides one-time migration from:
 * - EntityRegistry legacy relationships to UnifiedRelationship format
 * - FolderRelationshipCreator store to UnifiedRelationship format
 */

import { generateId } from '@/lib/utils/ids';
import type { EntityRegistry } from '@/lib/entities/entity-registry';
import type { UnifiedRelationship } from './types';
import { RelationshipSource } from './types';

interface LegacyEntityRelationship {
    id: string;
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    confidence: number;
    discoveredIn: string[];
    contexts: string[];
}

interface LegacyFolderRelationship {
    id: string;
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    inverseType?: string;
    bidirectional: boolean;
    confidence: number;
    provenance: {
        type: string;
        originId: string;
        timestamp: Date;
    };
    attributes: Record<string, any>;
}

export class RelationshipMigrationAdapter {
    /**
     * One-time migration from EntityRegistry relationships to UnifiedRelationship format
     */
    static importFromEntityRegistry(
        relationships: LegacyEntityRelationship[]
    ): UnifiedRelationship[] {
        const migrated: UnifiedRelationship[] = [];

        for (const rel of relationships) {
            migrated.push({
                id: rel.id || generateId(),
                sourceEntityId: rel.sourceEntityId,
                targetEntityId: rel.targetEntityId,
                type: rel.type,
                bidirectional: false,
                confidence: rel.confidence,
                confidenceBySource: {
                    [RelationshipSource.MANUAL]: rel.confidence
                },
                provenance: rel.discoveredIn.map((noteId, idx) => ({
                    source: RelationshipSource.MANUAL,
                    originId: noteId,
                    timestamp: new Date(),
                    confidence: rel.confidence,
                    context: rel.contexts[idx]
                })),
                attributes: {},
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        return migrated;
    }

    /**
     * Import folder-based relationships from FolderRelationshipCreator store
     */
    static importFromFolderStore(
        relationships: LegacyFolderRelationship[]
    ): UnifiedRelationship[] {
        const migrated: UnifiedRelationship[] = [];

        for (const rel of relationships) {
            migrated.push({
                id: rel.id || generateId(),
                sourceEntityId: rel.sourceEntityId,
                targetEntityId: rel.targetEntityId,
                type: rel.type,
                inverseType: rel.inverseType,
                bidirectional: rel.bidirectional,
                confidence: rel.confidence,
                confidenceBySource: {
                    [RelationshipSource.FOLDER_STRUCTURE]: rel.confidence
                },
                provenance: [{
                    source: RelationshipSource.FOLDER_STRUCTURE,
                    originId: rel.provenance.originId,
                    timestamp: rel.provenance.timestamp,
                    confidence: rel.confidence
                }],
                namespace: 'folder_structure',
                attributes: rel.attributes,
                createdAt: rel.provenance.timestamp,
                updatedAt: rel.provenance.timestamp
            });
        }

        return migrated;
    }

    /**
     * Convert a single folder relationship to unified format
     */
    static convertFolderRel(rel: LegacyFolderRelationship): UnifiedRelationship {
        return {
            id: rel.id || generateId(),
            sourceEntityId: rel.sourceEntityId,
            targetEntityId: rel.targetEntityId,
            type: rel.type,
            inverseType: rel.inverseType,
            bidirectional: rel.bidirectional,
            confidence: rel.confidence,
            confidenceBySource: {
                [RelationshipSource.FOLDER_STRUCTURE]: rel.confidence
            },
            provenance: [{
                source: RelationshipSource.FOLDER_STRUCTURE,
                originId: rel.provenance.originId,
                timestamp: rel.provenance.timestamp,
                confidence: rel.confidence
            }],
            namespace: 'folder_structure',
            attributes: rel.attributes,
            createdAt: rel.provenance.timestamp,
            updatedAt: rel.provenance.timestamp
        };
    }
}
