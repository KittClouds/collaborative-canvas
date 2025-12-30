import { cozoDb } from '../db';
// Layer 1 schemas are now managed by SQLite

import { EPISODE_SCHEMA } from './layer2-episodes';
import { ENTITY_SCHEMA } from './layer2-entities';
import { MENTIONS_SCHEMA } from './layer2-mentions';
import { ENTITY_EDGE_SCHEMA } from './layer2-edges';
import { NARRATIVE_HIERARCHY_SCHEMA, CAUSAL_LINK_SCHEMA } from './layer2-narrative';
import { TEMPORAL_POINT_SCHEMA } from './layer2-temporal';
import { TEMPORAL_MENTION_SCHEMA } from './layer2-temporal-mentions';
import {
  COMMUNITY_SCHEMA,
  COMMUNITY_MEMBER_SCHEMA,
  GRAPH_STATS_SCHEMA,
  SCOPE_PROCESSING_STATE_SCHEMA,
  SCHEMA_VERSION_SCHEMA
} from './layer2-analytics';
import {
  BLUEPRINT_META_SCHEMA,
  BLUEPRINT_VERSION_SCHEMA,
  BLUEPRINT_ENTITY_TYPE_SCHEMA,
  BLUEPRINT_FIELD_SCHEMA,
  BLUEPRINT_RELATIONSHIP_TYPE_SCHEMA,
  BLUEPRINT_ATTRIBUTE_SCHEMA,
  BLUEPRINT_VIEW_TEMPLATE_SCHEMA,
  BLUEPRINT_MOC_SCHEMA,
  EXTRACTION_PROFILE_SCHEMA,
  EXTRACTION_LABEL_MAPPING_SCHEMA,
  EXTRACTION_IGNORE_LIST_SCHEMA,
} from './layer3-blueprints';
import { FOLDER_HIERARCHY_SCHEMA } from './layer2-folder-hierarchy';
import { NETWORK_INSTANCE_SCHEMA } from './layer2-network-instance';
import { NETWORK_MEMBERSHIP_SCHEMA } from './layer2-network-membership';
import { NETWORK_RELATIONSHIP_SCHEMA } from './layer2-network-relationship';
import { MUTATION_LOG_SCHEMA } from './layer1-mutation-log';
import {
  NOTE_ENTITY_LINKS_SCHEMA,
  ENTITY_BACKLINKS_SCHEMA,
} from './layer2-bidirectional-links';
import { TIME_UNIT_SCHEMA, TIME_UNIT_EDGE_SCHEMA } from './layer2-time-registry';

export const SCHEMA_VERSION = '1.5.0';

const ALL_SCHEMAS = [
  { name: 'episode', schema: EPISODE_SCHEMA },
  { name: 'entity', schema: ENTITY_SCHEMA },
  { name: 'mentions', schema: MENTIONS_SCHEMA },
  { name: 'entity_edge', schema: ENTITY_EDGE_SCHEMA },
  { name: 'narrative_hierarchy', schema: NARRATIVE_HIERARCHY_SCHEMA },
  { name: 'causal_link', schema: CAUSAL_LINK_SCHEMA },
  { name: 'temporal_point', schema: TEMPORAL_POINT_SCHEMA },
  { name: 'community', schema: COMMUNITY_SCHEMA },
  { name: 'community_member', schema: COMMUNITY_MEMBER_SCHEMA },
  { name: 'graph_stats', schema: GRAPH_STATS_SCHEMA },
  { name: 'scope_processing_state', schema: SCOPE_PROCESSING_STATE_SCHEMA },
  { name: 'schema_version', schema: SCHEMA_VERSION_SCHEMA },
  { name: 'blueprint_meta', schema: BLUEPRINT_META_SCHEMA },
  { name: 'blueprint_version', schema: BLUEPRINT_VERSION_SCHEMA },
  { name: 'blueprint_entity_type', schema: BLUEPRINT_ENTITY_TYPE_SCHEMA },
  { name: 'blueprint_field', schema: BLUEPRINT_FIELD_SCHEMA },
  { name: 'blueprint_relationship_type', schema: BLUEPRINT_RELATIONSHIP_TYPE_SCHEMA },
  { name: 'blueprint_attribute', schema: BLUEPRINT_ATTRIBUTE_SCHEMA },
  { name: 'blueprint_view_template', schema: BLUEPRINT_VIEW_TEMPLATE_SCHEMA },
  { name: 'blueprint_moc', schema: BLUEPRINT_MOC_SCHEMA },
  { name: 'extraction_profile', schema: EXTRACTION_PROFILE_SCHEMA },
  { name: 'extraction_label_mapping', schema: EXTRACTION_LABEL_MAPPING_SCHEMA },
  { name: 'extraction_ignore_list', schema: EXTRACTION_IGNORE_LIST_SCHEMA },
  { name: 'folder_hierarchy', schema: FOLDER_HIERARCHY_SCHEMA },
  { name: 'network_instance', schema: NETWORK_INSTANCE_SCHEMA },
  { name: 'network_membership', schema: NETWORK_MEMBERSHIP_SCHEMA },
  { name: 'network_relationship', schema: NETWORK_RELATIONSHIP_SCHEMA },
  { name: 'mutation_log', schema: MUTATION_LOG_SCHEMA },
  { name: 'note_entity_links', schema: NOTE_ENTITY_LINKS_SCHEMA },
  { name: 'entity_backlinks', schema: ENTITY_BACKLINKS_SCHEMA },
  { name: 'temporal_mention', schema: TEMPORAL_MENTION_SCHEMA },
  { name: 'time_unit', schema: TIME_UNIT_SCHEMA },
  { name: 'time_unit_sequence', schema: TIME_UNIT_EDGE_SCHEMA },
];

export interface SchemaInitResult {
  success: boolean;
  version: string;
  relationsCreated: string[];
  errors: string[];
}

export async function initCozoGraphSchema(): Promise<SchemaInitResult> {
  const result: SchemaInitResult = {
    success: true,
    version: SCHEMA_VERSION,
    relationsCreated: [],
    errors: [],
  };

  try {
    await cozoDb.init();

    const versionCheck = cozoDb.runQuery(`
      ?[version, created_at] := *schema_version{version, created_at}
      :order -created_at
      :limit 1
    `);

    if (versionCheck.rows && versionCheck.rows.length > 0) {
      const existingVersion = versionCheck.rows[0][0] as string;
      console.log('Schema already initialized:', existingVersion);
      result.version = existingVersion;
      return result;
    }

    for (const { name, schema } of ALL_SCHEMAS) {
      try {
        const createResult = cozoDb.runQuery(schema);
        if (createResult.ok === false) {
          result.errors.push(`Failed to create ${name}: ${createResult.message}`);
          result.success = false;
        } else {
          result.relationsCreated.push(name);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (!errorMessage.includes('already exists')) {
          result.errors.push(`Error creating ${name}: ${errorMessage}`);
          result.success = false;
        } else {
          result.relationsCreated.push(`${name} (existing)`);
        }
      }
    }

    if (result.success) {
      cozoDb.runQuery(`
        ?[version, created_at] <- [["${SCHEMA_VERSION}", ${Date.now()}]]
        :put schema_version { version, created_at }
      `);
      console.log('CozoDB schema initialized:', SCHEMA_VERSION);
    }

  } catch (err) {
    result.success = false;
    result.errors.push(`Initialization error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

export function checkSchemaExists(): boolean {
  try {
    if (!cozoDb.isReady()) {
      return false;
    }

    const result = cozoDb.runQuery(`
      ?[version] := *schema_version{version}
      :limit 1
    `);

    return result.rows !== undefined && result.rows.length > 0;
  } catch {
    return false;
  }
}

export function getSchemaVersion(): string | null {
  try {
    if (!cozoDb.isReady()) {
      return null;
    }

    const result = cozoDb.runQuery(`
      ?[version, created_at] := *schema_version{version, created_at}
      :order -created_at
      :limit 1
    `);

    if (result.rows && result.rows.length > 0) {
      return result.rows[0][0] as string;
    }

    return null;
  } catch {
    return null;
  }
}

export async function resetSchema(): Promise<SchemaInitResult> {
  const relations = ALL_SCHEMAS.map(s => s.name);

  for (const relation of relations) {
    try {
      cozoDb.runQuery(`:rm ${relation} {}`);
    } catch {
    }
  }

  return initCozoGraphSchema();
}

export function listRelations(): string[] {
  try {
    const result = cozoDb.runQuery('::relations');
    if (result.rows) {
      return result.rows.map((row: unknown[]) => row[0] as string);
    }
    return [];
  } catch {
    return [];
  }
}

export function getRelationInfo(relationName: string): object | null {
  try {
    const result = cozoDb.runQuery(`::columns ${relationName}`);
    return result;
  } catch {
    return null;
  }
}
