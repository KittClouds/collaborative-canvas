// Seed Blueprint - Creates starter blueprint data
import {
  createEntityType,
  createField,
  createRelationshipType,
  createMOC,
} from './storage';

/**
 * Seeds a version with starter blueprint data
 * Creates basic entity types, fields, relationships, and a sample MOC
 */
export async function seedStarterBlueprint(versionId: string): Promise<void> {
  try {
    // Create Entity Types
    const noteEntity = await createEntityType({
      version_id: versionId,
      entity_kind: 'NOTE',
      display_name: 'Note',
      description: 'General purpose note',
      icon: 'FileText',
      color: '#3b82f6',
      is_abstract: false,
    });

    const characterEntity = await createEntityType({
      version_id: versionId,
      entity_kind: 'CHARACTER',
      display_name: 'Character',
      description: 'Character in the story',
      icon: 'User',
      color: '#ef4444',
      is_abstract: false,
    });

    const locationEntity = await createEntityType({
      version_id: versionId,
      entity_kind: 'LOCATION',
      display_name: 'Location',
      description: 'Place or setting',
      icon: 'MapPin',
      color: '#10b981',
      is_abstract: false,
    });

    const itemEntity = await createEntityType({
      version_id: versionId,
      entity_kind: 'ITEM',
      display_name: 'Item',
      description: 'Object or artifact',
      icon: 'Package',
      color: '#f59e0b',
      is_abstract: false,
    });

    const factionEntity = await createEntityType({
      version_id: versionId,
      entity_kind: 'FACTION',
      display_name: 'Faction',
      description: 'Group or organization',
      icon: 'Users',
      color: '#8b5cf6',
      is_abstract: false,
    });

    // Create Fields for Character
    await createField({
      entity_type_id: characterEntity.entity_type_id,
      field_name: 'age',
      display_label: 'Age',
      data_type: 'number',
      is_required: false,
      is_array: false,
      display_order: 1,
      description: 'Character age',
    });

    await createField({
      entity_type_id: characterEntity.entity_type_id,
      field_name: 'role',
      display_label: 'Role',
      data_type: 'string',
      is_required: false,
      is_array: false,
      display_order: 2,
      description: 'Character role or archetype',
    });

    await createField({
      entity_type_id: characterEntity.entity_type_id,
      field_name: 'alignment',
      display_label: 'Alignment',
      data_type: 'enum',
      is_required: false,
      is_array: false,
      display_order: 3,
      description: 'Character alignment',
      ui_hints: {
        widget: 'select',
        options: [
          { label: 'Good', value: 'good' },
          { label: 'Neutral', value: 'neutral' },
          { label: 'Evil', value: 'evil' },
        ],
      },
    });

    // Create Fields for Location
    await createField({
      entity_type_id: locationEntity.entity_type_id,
      field_name: 'coordinates',
      display_label: 'Coordinates',
      data_type: 'string',
      is_required: false,
      is_array: false,
      display_order: 1,
      description: 'Geographic coordinates',
    });

    await createField({
      entity_type_id: locationEntity.entity_type_id,
      field_name: 'climate',
      display_label: 'Climate',
      data_type: 'string',
      is_required: false,
      is_array: false,
      display_order: 2,
      description: 'Climate type',
    });

    // Create Fields for Item
    await createField({
      entity_type_id: itemEntity.entity_type_id,
      field_name: 'rarity',
      display_label: 'Rarity',
      data_type: 'enum',
      is_required: false,
      is_array: false,
      display_order: 1,
      description: 'Item rarity',
      ui_hints: {
        widget: 'select',
        options: [
          { label: 'Common', value: 'common' },
          { label: 'Uncommon', value: 'uncommon' },
          { label: 'Rare', value: 'rare' },
          { label: 'Legendary', value: 'legendary' },
        ],
      },
    });

    // Create Fields for Faction
    await createField({
      entity_type_id: factionEntity.entity_type_id,
      field_name: 'size',
      display_label: 'Size',
      data_type: 'number',
      is_required: false,
      is_array: false,
      display_order: 1,
      description: 'Number of members',
    });

    await createField({
      entity_type_id: factionEntity.entity_type_id,
      field_name: 'influence',
      display_label: 'Influence',
      data_type: 'enum',
      is_required: false,
      is_array: false,
      display_order: 2,
      description: 'Level of influence',
      ui_hints: {
        widget: 'select',
        options: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
        ],
      },
    });

    // Create Relationships
    await createRelationshipType({
      version_id: versionId,
      relationship_name: 'LINKS_TO',
      display_label: 'Links To',
      source_entity_kind: 'NOTE',
      target_entity_kind: 'NOTE',
      direction: 'directed',
      cardinality: 'many_to_many',
      is_symmetric: false,
      description: 'General link between notes',
    });

    await createRelationshipType({
      version_id: versionId,
      relationship_name: 'MENTIONS',
      display_label: 'Mentions',
      source_entity_kind: 'NOTE',
      target_entity_kind: 'CHARACTER',
      direction: 'directed',
      cardinality: 'many_to_many',
      is_symmetric: false,
      description: 'Note mentions a character',
    });

    await createRelationshipType({
      version_id: versionId,
      relationship_name: 'LOCATED_IN',
      display_label: 'Located In',
      source_entity_kind: 'CHARACTER',
      target_entity_kind: 'LOCATION',
      direction: 'directed',
      cardinality: 'many_to_one',
      is_symmetric: false,
      description: 'Character is located in a place',
    });

    await createRelationshipType({
      version_id: versionId,
      relationship_name: 'MEMBER_OF',
      display_label: 'Member Of',
      source_entity_kind: 'CHARACTER',
      target_entity_kind: 'FACTION',
      direction: 'directed',
      cardinality: 'many_to_one',
      is_symmetric: false,
      description: 'Character is a member of a faction',
    });

    await createRelationshipType({
      version_id: versionId,
      relationship_name: 'OWNS',
      display_label: 'Owns',
      source_entity_kind: 'CHARACTER',
      target_entity_kind: 'ITEM',
      direction: 'directed',
      cardinality: 'many_to_many',
      is_symmetric: false,
      description: 'Character owns an item',
    });

    // Create a sample MOC
    await createMOC({
      version_id: versionId,
      moc_name: 'World Index',
      entity_kinds: ['NOTE', 'CHARACTER', 'LOCATION', 'FACTION', 'ITEM'],
      description: 'Master index for all world-building elements',
    });

    console.log('Starter blueprint seeded successfully');
  } catch (error) {
    console.error('Error seeding starter blueprint:', error);
    throw error;
  }
}
