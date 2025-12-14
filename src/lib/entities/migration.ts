import type { EntityKind } from './entityTypes';
import { parseEntityFromTitle, parseFolderEntityFromName } from './titleParser';

/**
 * Note with entity properties (matches NotesContext Note interface)
 */
interface NoteForMigration {
  id: string;
  title: string;
  folderId?: string;
  entityKind?: EntityKind;
  entitySubtype?: string;
  entityLabel?: string;
  isEntity?: boolean;
}

/**
 * Folder with entity properties (matches NotesContext Folder interface)
 */
interface FolderForMigration {
  id: string;
  name: string;
  parentId?: string;
  entityKind?: EntityKind;
  entitySubtype?: string;
  entityLabel?: string;
  isTypedRoot?: boolean;
  isSubtypeRoot?: boolean;
  inheritedKind?: EntityKind;
  inheritedSubtype?: string;
}

/**
 * Migrate existing notes to include entity properties
 * Parses titles and sets entityKind, entityLabel, isEntity
 */
export function migrateExistingNotes<T extends NoteForMigration>(notes: T[]): T[] {
  return notes.map(note => {
    const parsed = parseEntityFromTitle(note.title);
    
    if (parsed && parsed.label) {
      return {
        ...note,
        entityKind: parsed.kind,
        entitySubtype: parsed.subtype,
        entityLabel: parsed.label,
        isEntity: true,
      };
    }
    
    // Not an entity note, clear entity properties if present
    return {
      ...note,
      entityKind: undefined,
      entitySubtype: undefined,
      entityLabel: undefined,
      isEntity: false,
    };
  });
}

/**
 * Migrate existing folders to include entity properties
 * Parses names and sets entityKind, entityLabel, isTypedRoot
 * Also propagates inheritedKind to children
 */
export function migrateExistingFolders<T extends FolderForMigration>(folders: T[]): T[] {
  // First pass: parse folder names
  const parsedFolders = folders.map(folder => {
    const parsed = parseFolderEntityFromName(folder.name);
    
    if (parsed) {
      return {
        ...folder,
        entityKind: parsed.kind,
        entitySubtype: parsed.subtype,
        entityLabel: parsed.label,
        isTypedRoot: parsed.isTypedRoot,
        isSubtypeRoot: parsed.isSubtypeRoot,
      };
    }
    
    // Regular folder
    return {
      ...folder,
      entityKind: undefined,
      entitySubtype: undefined,
      entityLabel: undefined,
      isTypedRoot: false,
      isSubtypeRoot: false,
    };
  });
  
  // Second pass: propagate inheritedKind and inheritedSubtype from parent folders
  const folderMap = new Map(parsedFolders.map(f => [f.id, f]));
  
  function getInheritedKind(folder: FolderForMigration): EntityKind | undefined {
    if (folder.entityKind) return folder.entityKind;
    if (folder.parentId) {
      const parent = folderMap.get(folder.parentId);
      if (parent) {
        return parent.entityKind || getInheritedKind(parent);
      }
    }
    return undefined;
  }
  
  function getInheritedSubtype(folder: FolderForMigration): string | undefined {
    if (folder.entitySubtype) return folder.entitySubtype;
    if (folder.parentId) {
      const parent = folderMap.get(folder.parentId);
      if (parent) {
        return parent.entitySubtype || getInheritedSubtype(parent);
      }
    }
    return undefined;
  }
  
  return parsedFolders.map(folder => {
    if (folder.parentId) {
      const parent = folderMap.get(folder.parentId);
      if (parent) {
        const inheritedKind = getInheritedKind(parent);
        const inheritedSubtype = getInheritedSubtype(parent);
        return {
          ...folder,
          inheritedKind: inheritedKind || folder.inheritedKind,
          inheritedSubtype: inheritedSubtype || folder.inheritedSubtype,
        };
      }
    }
    return folder;
  });
}

/**
 * Get the effective entity kind for a note, considering folder inheritance
 */
export function getEffectiveEntityKind<N extends NoteForMigration, F extends FolderForMigration>(
  note: N,
  folders: F[]
): EntityKind | undefined {
  // Note's own entityKind takes precedence
  if (note.entityKind) return note.entityKind;
  
  // Otherwise, inherit from folder
  if (note.folderId) {
    const folder = folders.find(f => f.id === note.folderId);
    if (folder) {
      return folder.entityKind || folder.inheritedKind;
    }
  }
  
  return undefined;
}

/**
 * Validate that a note's entity kind matches its folder's kind
 * Returns warning message if mismatch, null if valid
 */
export function validateEntityKindMatch<N extends NoteForMigration, F extends FolderForMigration>(
  note: N,
  folders: F[]
): string | null {
  if (!note.isEntity || !note.entityKind || !note.folderId) {
    return null; // Not an entity note or not in a folder
  }
  
  const folder = folders.find(f => f.id === note.folderId);
  if (!folder) return null;
  
  const folderKind = folder.entityKind || folder.inheritedKind;
  if (!folderKind) return null; // Folder is not typed
  
  if (note.entityKind !== folderKind) {
    return `Entity kind "${note.entityKind}" does not match folder kind "${folderKind}"`;
  }
  
  return null;
}

/**
 * Check if migration is needed (any notes/folders missing entity properties)
 */
export function needsMigration<N extends NoteForMigration, F extends FolderForMigration>(
  notes: N[],
  folders: F[]
): boolean {
  // Check if any note with entity syntax is missing isEntity flag
  for (const note of notes) {
    const parsed = parseEntityFromTitle(note.title);
    if (parsed && parsed.label && !note.isEntity) {
      return true;
    }
  }
  
  // Check if any folder with entity syntax is missing properties
  for (const folder of folders) {
    const parsed = parseFolderEntityFromName(folder.name);
    if (parsed && folder.isTypedRoot === undefined) {
      return true;
    }
  }
  
  return false;
}
