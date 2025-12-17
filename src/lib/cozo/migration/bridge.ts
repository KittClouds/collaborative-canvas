import { cozoDb } from '../db';
import { NOTE_QUERIES } from '../schema/layer1-notes';
import { FOLDER_QUERIES } from '../schema/layer1-folders';
import { LINK_QUERIES } from '../schema/layer1-links';
import type { Note, Folder } from '@/contexts/NotesContext';
import type { 
  CozoNote, 
  CozoFolder, 
  CozoWikilink,
  GraphScope 
} from '../types';
import { buildScopeIdentifier } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface MigrationResult {
  success: boolean;
  notesImported: number;
  foldersImported: number;
  wikilinksCreated: number;
  tagsCreated: number;
  errors: string[];
}

export function extractPlainText(content: string): string {
  if (!content) return '';
  
  try {
    const doc = JSON.parse(content);
    return extractTextFromNode(doc);
  } catch {
    return content;
  }
}

function extractTextFromNode(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  
  const nodeObj = node as Record<string, unknown>;
  
  if (nodeObj.type === 'text' && typeof nodeObj.text === 'string') {
    return nodeObj.text;
  }
  
  if (Array.isArray(nodeObj.content)) {
    return nodeObj.content.map((child: unknown) => extractTextFromNode(child)).join(' ');
  }
  
  return '';
}

export function computeFolderPath(folder: Folder, allFolders: Folder[]): string {
  const parts: string[] = [folder.name];
  let current = folder;
  
  while (current.parentId) {
    const parent = allFolders.find(f => f.id === current.parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    current = parent;
  }
  
  return '/' + parts.join('/');
}

export function noteToCozo(note: Note): CozoNote {
  let contentJson: object = {};
  try {
    contentJson = JSON.parse(note.content || '{}');
  } catch {
    contentJson = { type: 'doc', content: [] };
  }

  return {
    id: note.id,
    title: note.title,
    contentJson,
    contentText: extractPlainText(note.content),
    folderId: note.folderId,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    entityKind: note.entityKind,
    entitySubtype: note.entitySubtype,
    entityLabel: note.entityLabel,
    isCanonicalEntity: note.isEntity || false,
    isPinned: note.isPinned,
    isFavorite: note.favorite || false,
    tags: note.tags || [],
    attributes: note.connections?.entities?.[0]?.attributes,
  };
}

export function folderToCozo(folder: Folder, allFolders: Folder[]): CozoFolder {
  return {
    id: folder.id,
    name: folder.name,
    path: computeFolderPath(folder, allFolders),
    parentId: folder.parentId,
    createdAt: folder.createdAt,
    color: folder.color,
    entityKind: folder.entityKind,
    entitySubtype: folder.entitySubtype,
    entityLabel: folder.entityLabel,
    isTypedRoot: folder.isTypedRoot || false,
    isSubtypeRoot: folder.isSubtypeRoot || false,
    inheritedKind: folder.inheritedKind,
    inheritedSubtype: folder.inheritedSubtype,
  };
}

export function upsertNote(note: CozoNote): boolean {
  try {
    const result = cozoDb.runQuery(NOTE_QUERIES.upsert, {
      id: note.id,
      title: note.title,
      content_json: note.contentJson,
      content_text: note.contentText,
      folder_id: note.folderId || null,
      created_at: note.createdAt.getTime(),
      updated_at: note.updatedAt.getTime(),
      entity_kind: note.entityKind || null,
      entity_subtype: note.entitySubtype || null,
      entity_label: note.entityLabel || null,
      is_canonical_entity: note.isCanonicalEntity,
      is_pinned: note.isPinned,
      is_favorite: note.isFavorite,
      tags: note.tags,
      attributes: note.attributes || null,
    });
    return result.ok !== false;
  } catch (err) {
    console.error('Failed to upsert note:', err);
    return false;
  }
}

export function upsertFolder(folder: CozoFolder): boolean {
  try {
    const result = cozoDb.runQuery(FOLDER_QUERIES.upsert, {
      id: folder.id,
      name: folder.name,
      path: folder.path,
      parent_id: folder.parentId || null,
      created_at: folder.createdAt.getTime(),
      color: folder.color || null,
      entity_kind: folder.entityKind || null,
      entity_subtype: folder.entitySubtype || null,
      entity_label: folder.entityLabel || null,
      is_typed_root: folder.isTypedRoot,
      is_subtype_root: folder.isSubtypeRoot,
      inherited_kind: folder.inheritedKind || null,
      inherited_subtype: folder.inheritedSubtype || null,
    });
    return result.ok !== false;
  } catch (err) {
    console.error('Failed to upsert folder:', err);
    return false;
  }
}

export function extractWikilinks(noteId: string, content: string): CozoWikilink[] {
  const links: CozoWikilink[] = [];
  const plainText = extractPlainText(content);
  
  const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
  let match;
  while ((match = wikilinkRegex.exec(plainText)) !== null) {
    const targetTitle = match[1].trim();
    const displayText = match[2]?.trim();
    const context = getContext(plainText, match.index, match[0].length);
    
    links.push({
      id: uuidv4(),
      sourceNoteId: noteId,
      targetTitle,
      displayText,
      linkType: 'wikilink',
      context,
      charPosition: match.index,
      createdAt: new Date(),
    });
  }
  
  const entityRegex = /\[([A-Z][A-Z_]*)(?::[A-Z_]+)?\|([^\]]+)\]/g;
  while ((match = entityRegex.exec(plainText)) !== null) {
    const entityLabel = match[2].trim();
    const context = getContext(plainText, match.index, match[0].length);
    
    links.push({
      id: uuidv4(),
      sourceNoteId: noteId,
      targetTitle: entityLabel,
      linkType: 'entity',
      context,
      charPosition: match.index,
      createdAt: new Date(),
    });
  }
  
  return links;
}

function getContext(text: string, index: number, matchLength: number, radius: number = 40): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + matchLength + radius);
  
  let context = text.slice(start, end).trim();
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';
  
  return context;
}

export function extractTags(noteId: string, content: string): { tag: string; createdAt: Date }[] {
  const tags: { tag: string; createdAt: Date }[] = [];
  const plainText = extractPlainText(content);
  const seen = new Set<string>();
  
  const tagRegex = /#(\w+)/g;
  let match;
  while ((match = tagRegex.exec(plainText)) !== null) {
    const tag = match[1].toLowerCase();
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push({ tag, createdAt: new Date() });
    }
  }
  
  return tags;
}

export function upsertWikilink(link: CozoWikilink): boolean {
  try {
    const result = cozoDb.runQuery(LINK_QUERIES.upsertWikilink, {
      id: link.id,
      source_note_id: link.sourceNoteId,
      target_title: link.targetTitle,
      target_note_id: link.targetNoteId || null,
      display_text: link.displayText || null,
      link_type: link.linkType,
      context: link.context || null,
      char_position: link.charPosition || null,
      created_at: link.createdAt.getTime(),
    });
    return result.ok !== false;
  } catch (err) {
    console.error('Failed to upsert wikilink:', err);
    return false;
  }
}

export function upsertTag(noteId: string, tag: string): boolean {
  try {
    const result = cozoDb.runQuery(LINK_QUERIES.upsertTag, {
      note_id: noteId,
      tag,
      created_at: Date.now(),
    });
    return result.ok !== false;
  } catch (err) {
    console.error('Failed to upsert tag:', err);
    return false;
  }
}

export async function migrateNotesToCozo(notes: Note[]): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;

  for (const note of notes) {
    const cozoNote = noteToCozo(note);
    if (upsertNote(cozoNote)) {
      imported++;
    } else {
      errors.push(`Failed to import note: ${note.title}`);
    }
  }

  return { imported, errors };
}

export async function migrateFoldersToCozo(folders: Folder[]): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;

  const sortedFolders = [...folders].sort((a, b) => {
    const aDepth = computeFolderPath(a, folders).split('/').length;
    const bDepth = computeFolderPath(b, folders).split('/').length;
    return aDepth - bDepth;
  });

  for (const folder of sortedFolders) {
    const cozoFolder = folderToCozo(folder, folders);
    if (upsertFolder(cozoFolder)) {
      imported++;
    } else {
      errors.push(`Failed to import folder: ${folder.name}`);
    }
  }

  return { imported, errors };
}

export async function migrateLinksToCozo(notes: Note[]): Promise<{ wikilinks: number; tags: number; errors: string[] }> {
  const errors: string[] = [];
  let wikilinks = 0;
  let tags = 0;

  for (const note of notes) {
    const links = extractWikilinks(note.id, note.content);
    for (const link of links) {
      if (upsertWikilink(link)) {
        wikilinks++;
      }
    }

    const extractedTags = extractTags(note.id, note.content);
    for (const { tag } of extractedTags) {
      if (upsertTag(note.id, tag)) {
        tags++;
      }
    }

    for (const tag of note.tags || []) {
      if (upsertTag(note.id, tag)) {
        tags++;
      }
    }
  }

  return { wikilinks, tags, errors };
}

export async function runFullMigration(notes: Note[], folders: Folder[]): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    notesImported: 0,
    foldersImported: 0,
    wikilinksCreated: 0,
    tagsCreated: 0,
    errors: [],
  };

  const folderResult = await migrateFoldersToCozo(folders);
  result.foldersImported = folderResult.imported;
  result.errors.push(...folderResult.errors);

  const noteResult = await migrateNotesToCozo(notes);
  result.notesImported = noteResult.imported;
  result.errors.push(...noteResult.errors);

  const linkResult = await migrateLinksToCozo(notes);
  result.wikilinksCreated = linkResult.wikilinks;
  result.tagsCreated = linkResult.tags;
  result.errors.push(...linkResult.errors);

  result.success = result.errors.length === 0;

  console.log('Migration complete:', {
    folders: result.foldersImported,
    notes: result.notesImported,
    wikilinks: result.wikilinksCreated,
    tags: result.tagsCreated,
  });

  return result;
}

export function resolveWikilinks(): number {
  try {
    const result = cozoDb.runQuery(LINK_QUERIES.resolveWikilinks);
    if (result.rows) {
      for (const [wikilinkId, targetNoteId] of result.rows) {
        cozoDb.runQuery(`
          ?[id, target_note_id] <- [[$id, $target_note_id]]
          :update wikilink { id => target_note_id }
        `, { id: wikilinkId, target_note_id: targetNoteId });
      }
      return result.rows.length;
    }
    return 0;
  } catch (err) {
    console.error('Failed to resolve wikilinks:', err);
    return 0;
  }
}
