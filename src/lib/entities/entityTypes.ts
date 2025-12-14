export const ENTITY_KINDS = [
  "CHARACTER",
  "LOCATION",
  "NPC",
  "ITEM",
  "FACTION",
  "SCENE",
  "EVENT",
  "CONCEPT",
] as const;

export type EntityKind = typeof ENTITY_KINDS[number];

/**
 * Subtypes for each entity kind - storytelling focused
 */
export const ENTITY_SUBTYPES: Record<EntityKind, readonly string[]> = {
  CHARACTER: ["PROTAGONIST", "ANTAGONIST", "ALLY", "NEUTRAL", "ENEMY"] as const,
  LOCATION: ["CONTINENT", "COUNTRY", "CITY", "TOWN", "VILLAGE", "LANDMARK", "BUILDING", "ROOM"] as const,
  NPC: ["MERCHANT", "GUARD", "NOBLE", "COMMONER", "MYSTIC", "WARRIOR"] as const,
  ITEM: ["WEAPON", "ARMOR", "ARTIFACT", "CONSUMABLE", "KEY", "TREASURE"] as const,
  FACTION: ["GUILD", "KINGDOM", "ORDER", "CULT", "TRIBE", "ALLIANCE"] as const,
  SCENE: ["OPENING", "CLIMAX", "RESOLUTION", "FLASHBACK", "BEAT", "TRANSITION"] as const,
  EVENT: ["BATTLE", "CEREMONY", "DISCOVERY", "BETRAYAL", "MEETING", "DEATH"] as const,
  CONCEPT: ["MAGIC", "PROPHECY", "CURSE", "LAW", "CUSTOM", "LEGEND"] as const,
};

export type EntitySubtype = typeof ENTITY_SUBTYPES[EntityKind][number];

export interface Entity {
  kind: EntityKind;
  subtype?: string;
  label: string;
  attributes?: Record<string, any>;
}

/**
 * Entity reference with optional link to canonical note
 */
export interface EntityReference extends Entity {
  noteId?: string;      // ID of canonical entity note if exists
  positions?: number[]; // Character positions in content where mentioned
}

export interface Triple {
  subject: Entity;
  predicate: string;
  object: Entity;
}

export interface DocumentConnections {
  tags: string[];
  mentions: string[];
  links: string[];
  wikilinks: string[];
  entities: EntityReference[];  // Changed from Entity[] to include note linking
  triples: Triple[];
  backlinks: string[];
}

// Color mapping for entity kinds
export const ENTITY_COLORS: Record<EntityKind, string> = {
  CHARACTER: '#8b5cf6', // Purple
  LOCATION: '#3b82f6', // Blue
  NPC: '#f59e0b', // Orange
  ITEM: '#10b981', // Green
  FACTION: '#ef4444', // Red
  SCENE: '#ec4899', // Pink
  EVENT: '#14b8a6', // Teal
  CONCEPT: '#6366f1', // Indigo
};

/**
 * Check if a string is a valid entity kind
 */
export function isValidEntityKind(kind: string): kind is EntityKind {
  return ENTITY_KINDS.includes(kind as EntityKind);
}

/**
 * Check if a string is a valid subtype for a given kind
 */
export function isValidSubtype(kind: EntityKind, subtype: string): boolean {
  return ENTITY_SUBTYPES[kind]?.includes(subtype) ?? false;
}

/**
 * Get subtypes for a given entity kind
 */
export function getSubtypesForKind(kind: EntityKind): readonly string[] {
  return ENTITY_SUBTYPES[kind] || [];
}
