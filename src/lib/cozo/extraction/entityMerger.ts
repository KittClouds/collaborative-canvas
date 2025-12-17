import { cozoDb } from '../db';
import type { CozoEntity } from '../types';

/**
 * Find or create entity, merging with existing entities in scope
 */
export async function findOrCreateEntity(
    entity: CozoEntity,
    scopeGroupId: string
): Promise<string> {
    // Query for existing entity by (name, kind, subtype, group_id)
    const query = `
    ?[id, frequency, aliases, canonical_note_id] := 
      *entity{
        id, name, entity_kind, entity_subtype, group_id,
        frequency, aliases, canonical_note_id
      },
      name == $name,
      entity_kind == $entity_kind,
      group_id == $group_id,
      entity_subtype == $entity_subtype
  `;

    const result = await cozoDb.runQuery(query, {
        name: entity.name,
        entity_kind: entity.entityKind,
        entity_subtype: entity.entitySubtype || null,
        group_id: scopeGroupId,
    });

    if (result.rows && result.rows.length > 0) {
        // Entity exists - merge data
        const [existingId, frequency, aliases, canonicalNoteId] = result.rows[0];

        // Update frequency and aliases
        await cozoDb.run(`
      ?[id, frequency, aliases] := 
        id = $id,
        frequency = $frequency + $new_frequency,
        aliases = $merged_aliases
      
      :update entity { id, frequency, aliases }
    `, {
            id: existingId,
            frequency: frequency,
            new_frequency: entity.frequency,
            merged_aliases: [...new Set([...(aliases || []), ...(entity.aliases || [])])],
        });

        return existingId;
    } else {
        // Create new entity
        await cozoDb.run(`
      ?[
        id, name, entity_kind, entity_subtype, group_id, scope_type,
        created_at, extraction_method, aliases, frequency, participants,
        attributes
      ] <- [[
        $id, $name, $entity_kind, $entity_subtype, $group_id, $scope_type,
        now(), $extraction_method, $aliases, $frequency, $participants,
        $attributes
      ]]
      
      :put entity {
        id, name, entity_kind, entity_subtype, group_id, scope_type,
        created_at, extraction_method, aliases, frequency, participants,
        attributes
      }
    `, {
            id: entity.id,
            name: entity.name,
            entity_kind: entity.entityKind,
            entity_subtype: entity.entitySubtype || null,
            group_id: scopeGroupId,
            scope_type: entity.scopeType,
            extraction_method: entity.extractionMethod,
            aliases: entity.aliases || [],
            frequency: entity.frequency,
            participants: entity.participants || [],
            attributes: entity.attributes || {},
        });

        return entity.id;
    }
}

/**
 * Normalize entity name for fuzzy matching
 */
export function normalizeEntityName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ');
}

/**
 * Fuzzy match entities using Levenshtein distance
 */
export function fuzzyMatchEntity(
    name: string,
    existingEntities: CozoEntity[],
    threshold: number = 3
): CozoEntity | null {
    const normalized = normalizeEntityName(name);

    for (const entity of existingEntities) {
        const entityNormalized = normalizeEntityName(entity.name);
        const distance = levenshteinDistance(normalized, entityNormalized);

        if (distance <= threshold) {
            return entity;
        }

        // Check aliases
        for (const alias of entity.aliases) {
            const aliasNormalized = normalizeEntityName(alias);
            if (levenshteinDistance(normalized, aliasNormalized) <= threshold) {
                return entity;
            }
        }
    }

    return null;
}

/**
 * Levenshtein distance implementation
 */
function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}
