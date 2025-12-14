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
  entities: Entity[];
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
