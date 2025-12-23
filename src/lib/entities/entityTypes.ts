import {
  User,
  MapPin,
  Users,
  Package,
  Flag,
  Film,
  Calendar,
  Lightbulb,
  Waves,
  Drama,
  BookOpen,
  Zap,
  Hourglass,
  Book
} from "lucide-react";

export const ENTITY_KINDS = [
  "CHARACTER",
  "LOCATION",
  "NPC",
  "ITEM",
  "FACTION",
  "SCENE",
  "EVENT",
  "CONCEPT",
  "ARC",
  "ACT",
  "CHAPTER",
  "BEAT",
  "EVENT",
  "TIMELINE",
  "NARRATIVE",
] as const;

export type EntityKind = typeof ENTITY_KINDS[number];

/**
 * Narrative entity kinds - story structure entities
 */
export const NARRATIVE_ENTITY_KINDS = [
  "ARC",
  "ACT",
  "CHAPTER",
  "SCENE",
  "BEAT",
  "EVENT",
  "TIMELINE",
  "NARRATIVE",
] as const;

export type NarrativeEntityKind = typeof NARRATIVE_ENTITY_KINDS[number];

/**
 * Check if a kind is a narrative entity kind
 */
export function isNarrativeEntityKind(kind: string): kind is NarrativeEntityKind {
  return NARRATIVE_ENTITY_KINDS.includes(kind as NarrativeEntityKind);
}

/**
 * Subtypes for each entity kind - storytelling focused
 */
export const ENTITY_SUBTYPES: Record<EntityKind, readonly string[]> = {
  CHARACTER: ["PROTAGONIST", "ANTAGONIST", "ALLY", "NEUTRAL", "ENEMY"] as const,
  LOCATION: ["CONTINENT", "COUNTRY", "CITY", "TOWN", "VILLAGE", "LANDMARK", "BUILDING", "ROOM"] as const,
  NPC: ["MERCHANT", "GUARD", "NOBLE", "COMMONER", "MYSTIC", "WARRIOR"] as const,
  ITEM: ["WEAPON", "ARMOR", "ARTIFACT", "CONSUMABLE", "KEY", "TREASURE"] as const,
  FACTION: ["GUILD", "KINGDOM", "ORDER", "CULT", "TRIBE", "ALLIANCE"] as const,
  SCENE: ["OPENING", "CLIMAX", "RESOLUTION", "FLASHBACK", "TRANSITION", "DISCOVERY"] as const,
  EVENT: ["BATTLE", "CEREMONY", "DISCOVERY", "BETRAYAL", "MEETING", "DEATH", "PLOT", "HISTORICAL", "PERSONAL", "WORLD", "BACKGROUND"] as const,
  CONCEPT: ["MAGIC", "PROPHECY", "CURSE", "LAW", "CUSTOM", "LEGEND"] as const,
  ARC: ["MAIN", "SUBPLOT", "BACKSTORY", "ROMANCE", "MYSTERY", "REDEMPTION"] as const,
  ACT: ["SETUP", "CONFRONTATION", "RESOLUTION", "RISING", "FALLING", "CLIMAX"] as const,
  CHAPTER: ["OPENING", "MIDDLE", "CLOSING", "INTERLUDE", "EPILOGUE", "PROLOGUE"] as const,
  BEAT: ["ACTION", "DIALOGUE", "DESCRIPTION", "INTERNAL", "REVELATION", "DECISION"] as const,
  TIMELINE: ["MASTER", "ARC", "CHARACTER", "LOCATION", "CUSTOM"] as const,
  NARRATIVE: ["MASTER", "SERIES", "BOOK", "FILM", "GAME"] as const,
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
  EVENT: '#06b6d4', // Cyan
  CONCEPT: '#6366f1', // Indigo
  ARC: '#a855f7', // Violet
  ACT: '#2563eb', // Royal Blue
  CHAPTER: '#14b8a6', // Teal
  BEAT: '#f97316', // Orange
  TIMELINE: '#eab308', // Gold
  NARRATIVE: '#4f46e5', // Indigo/Deep Purple
};

// Icon mapping for entity kinds
export const ENTITY_ICONS: Record<EntityKind, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  CHARACTER: User,
  LOCATION: MapPin,
  NPC: Users,
  ITEM: Package,
  FACTION: Flag,
  SCENE: Film,
  EVENT: Calendar,
  CONCEPT: Lightbulb,
  ARC: Waves,
  ACT: Drama,
  CHAPTER: BookOpen,
  BEAT: Zap,
  TIMELINE: Hourglass,
  NARRATIVE: Book,
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
