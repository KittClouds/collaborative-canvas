import { EntityKind } from '@/lib/types/entityTypes';
import { EntityFactSheetSchema } from '@/types/factSheetTypes';
import { characterSchema } from './characterSchema';
import { locationSchema } from './locationSchema';
import { itemSchema } from './itemSchema';
import { factionSchema } from './factionSchema';
import { eventSchema } from './eventSchema';
import { conceptSchema } from './conceptSchema';
import { npcSchema } from './npcSchema';
import { sceneSchema } from './sceneSchema';

// Map entity kinds to their schemas
export const entitySchemas: Record<EntityKind, EntityFactSheetSchema> = {
  CHARACTER: characterSchema,
  LOCATION: locationSchema,
  ITEM: itemSchema,
  FACTION: factionSchema,
  EVENT: eventSchema,
  CONCEPT: conceptSchema,
  NPC: npcSchema,
  SCENE: sceneSchema,
  ARC: conceptSchema,
  ACT: conceptSchema,
  CHAPTER: conceptSchema,
  BEAT: conceptSchema,
  TIMELINE: eventSchema,
  NARRATIVE: conceptSchema,
  NETWORK: conceptSchema,
};

// Get schema for a specific entity kind
export function getSchemaForEntityKind(kind: EntityKind): EntityFactSheetSchema {
  return entitySchemas[kind];
}

// Export all schemas
export {
  characterSchema,
  locationSchema,
  itemSchema,
  factionSchema,
  eventSchema,
  conceptSchema,
  npcSchema,
  sceneSchema,
};
