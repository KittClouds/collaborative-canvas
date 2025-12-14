import { EntityKind, ENTITY_KINDS, isValidSubtype } from './entityTypes';

/**
 * Parsed entity from a title or folder name
 */
export interface ParsedEntity {
  kind: EntityKind;
  subtype?: string;
  label?: string;
}

/**
 * Parsed folder name result
 */
export interface ParsedFolderName extends ParsedEntity {
  isTypedRoot: boolean;
  isSubtypeRoot?: boolean; // [CHARACTER:ALLY] is a subtype root
}

/**
 * Parse entity syntax from a title: [KIND:SUBTYPE|Label], [KIND|Label], [KIND:SUBTYPE], or [KIND]
 * Returns null if not entity syntax
 */
export function parseEntityFromTitle(title: string): ParsedEntity | null {
  if (!title) return null;
  
  const trimmed = title.trim();
  
  // Match [KIND:SUBTYPE|Label], [KIND|Label], [KIND:SUBTYPE], or [KIND]
  const match = trimmed.match(/^\[([A-Z_]+)(?::([A-Z_]+))?(?:\|(.+))?\]$/);
  if (!match) return null;
  
  const [, kindStr, subtypeStr, label] = match;
  
  // Validate kind
  if (!ENTITY_KINDS.includes(kindStr as EntityKind)) {
    return null;
  }
  
  const kind = kindStr as EntityKind;
  
  // Validate subtype if present
  if (subtypeStr && !isValidSubtype(kind, subtypeStr)) {
    return null;
  }
  
  return {
    kind,
    subtype: subtypeStr,
    label: label?.trim(),
  };
}

/**
 * Parse folder name for entity typing
 * [KIND] = typed root folder (container for entities of this kind)
 * [KIND:SUBTYPE] = subtype root folder (container for subtypes)
 * [KIND|Label] = typed subfolder that is also an entity
 * [KIND:SUBTYPE|Label] = subtype entity folder
 */
export function parseFolderEntityFromName(name: string): ParsedFolderName | null {
  const parsed = parseEntityFromTitle(name);
  if (!parsed) return null;
  
  return {
    ...parsed,
    isTypedRoot: !parsed.label && !parsed.subtype, // [CHARACTER] is typed root
    isSubtypeRoot: !parsed.label && !!parsed.subtype, // [CHARACTER:ALLY] is subtype root
  };
}

/**
 * Format an entity as a title string
 */
export function formatEntityTitle(kind: EntityKind, label: string, subtype?: string): string {
  if (subtype) {
    return `[${kind}:${subtype}|${label}]`;
  }
  return `[${kind}|${label}]`;
}

/**
 * Format a typed folder name (root container)
 */
export function formatTypedFolderName(kind: EntityKind): string {
  return `[${kind}]`;
}

/**
 * Format a subtype folder name
 */
export function formatSubtypeFolderName(kind: EntityKind, subtype: string): string {
  return `[${kind}:${subtype}]`;
}

/**
 * Extract display name from entity title
 * [CHARACTER:ALLY|Jon Snow] → "Jon Snow"
 * [CHARACTER|Jon Snow] → "Jon Snow"
 * [CHARACTER:ALLY] → "ALLY"
 * [CHARACTER] → "CHARACTER"
 * "Regular Title" → "Regular Title"
 */
export function getDisplayName(title: string): string {
  const parsed = parseEntityFromTitle(title);
  if (!parsed) return title;
  return parsed.label || parsed.subtype || parsed.kind;
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
 * Check if a folder name represents a subtype root folder
 */
export function isSubtypeRootFolder(name: string): boolean {
  const parsed = parseFolderEntityFromName(name);
  return parsed !== null && (parsed.isSubtypeRoot ?? false);
}

/**
 * Check if a folder name represents a typed subfolder (entity folder)
 */
export function isTypedSubfolder(name: string): boolean {
  const parsed = parseFolderEntityFromName(name);
  return parsed !== null && !parsed.isTypedRoot && !parsed.isSubtypeRoot;
}
