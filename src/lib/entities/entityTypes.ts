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

export interface Entity {
  kind: EntityKind;
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
