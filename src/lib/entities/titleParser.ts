import { EntityKind, ENTITY_KINDS } from './entityTypes';

/**
 * Parsed entity from a title or folder name
 */
export interface ParsedEntity {
  kind: EntityKind;
  label?: string;
}

/**
 * Parsed folder name result
 */
export interface ParsedFolderName extends ParsedEntity {
  isTypedRoot: boolean;
}

/**
 * Parse entity syntax from a title: [KIND|Label] or [KIND]
 * Returns null if not entity syntax
 */
export function parseEntityFromTitle(title: string): ParsedEntity | null {
  if (!title) return null;
  
  const trimmed = title.trim();
  
  // Match [KIND|Label] or [KIND]
  const match = trimmed.match(/^\[([A-Z_]+)(?:\|(.+))?\]$/);
  if (!match) return null;
  
  const [, kindStr, label] = match;
  
  // Validate kind
  if (!ENTITY_KINDS.includes(kindStr as EntityKind)) {
    return null;
  }
  
  return {
    kind: kindStr as EntityKind,
    label: label?.trim(),
  };
}

/**
 * Parse folder name for entity typing
 * [KIND] = typed root folder (container for entities of this kind)
 * [KIND|Label] = typed subfolder that is also an entity
 */
export function parseFolderEntityFromName(name: string): ParsedFolderName | null {
  const parsed = parseEntityFromTitle(name);
  if (!parsed) return null;
  
  return {
    ...parsed,
    isTypedRoot: !parsed.label, // [CHARACTER] is typed root, [CHARACTER|Stark Family] is not
  };
}

/**
 * Format an entity as a title string
 */
export function formatEntityTitle(kind: EntityKind, label: string): string {
  return `[${kind}|${label}]`;
}

/**
 * Format a typed folder name (root container)
 */
export function formatTypedFolderName(kind: EntityKind): string {
  return `[${kind}]`;
}

/**
 * Extract display name from entity title
 * [CHARACTER|Jon Snow] → "Jon Snow"
 * [CHARACTER] → "CHARACTER"
 * "Regular Title" → "Regular Title"
 */
export function getDisplayName(title: string): string {
  const parsed = parseEntityFromTitle(title);
  if (!parsed) return title;
  return parsed.label || parsed.kind;
}

/**
 * Check if a title represents an entity (has both kind and label)
 */
export function isEntityTitle(title: string): boolean {
  const parsed = parseEntityFromTitle(title);
  return parsed !== null && parsed.label !== undefined;
}

/**
 * Check if a folder name represents a typed root folder
 */
export function isTypedRootFolder(name: string): boolean {
  const parsed = parseFolderEntityFromName(name);
  return parsed !== null && parsed.isTypedRoot;
}

/**
 * Check if a folder name represents a typed subfolder (entity folder)
 */
export function isTypedSubfolder(name: string): boolean {
  const parsed = parseFolderEntityFromName(name);
  return parsed !== null && !parsed.isTypedRoot;
}
