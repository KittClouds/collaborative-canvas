import type { Note, Folder } from '@/contexts/NotesContext';
import type { SyncNote, SyncFolder, SyncEntity, SyncEdge, ProvenanceRecord, AlternateTypeInterpretation, EntitySource } from './types';

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

export function computeFolderPath(folder: { name: string; parentId?: string | null }, allFolders: Array<{ id: string; name: string; parentId?: string | null }>): string {
  const parts: string[] = [folder.name];
  let currentParentId = folder.parentId;
  while (currentParentId) {
    const parent = allFolders.find(f => f.id === currentParentId);
    if (!parent) break;
    parts.unshift(parent.name);
    currentParentId = parent.parentId;
  }
  return '/' + parts.join('/');
}

export function toSyncNote(note: Note): SyncNote {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    contentText: extractPlainText(note.content),
    folderId: note.folderId ?? null,
    createdAt: note.createdAt instanceof Date ? note.createdAt.getTime() : note.createdAt,
    updatedAt: note.updatedAt instanceof Date ? note.updatedAt.getTime() : note.updatedAt,
    entityKind: note.entityKind ?? null,
    entitySubtype: note.entitySubtype ?? null,
    entityLabel: note.entityLabel ?? null,
    isCanonicalEntity: note.isEntity ?? false,
    isPinned: note.isPinned,
    isFavorite: note.favorite ?? false,
    tags: note.tags || [],
  };
}

export function fromSyncNote(syncNote: SyncNote): Note {
  return {
    id: syncNote.id,
    title: syncNote.title,
    content: syncNote.content,
    createdAt: new Date(syncNote.createdAt),
    updatedAt: new Date(syncNote.updatedAt),
    folderId: syncNote.folderId ?? undefined,
    tags: syncNote.tags,
    isPinned: syncNote.isPinned,
    favorite: syncNote.isFavorite,
    entityKind: syncNote.entityKind ?? undefined,
    entitySubtype: syncNote.entitySubtype ?? undefined,
    entityLabel: syncNote.entityLabel ?? undefined,
    isEntity: syncNote.isCanonicalEntity,
  };
}

export function toSyncFolder(folder: Folder, allFolders: Folder[] = []): SyncFolder {
  return {
    id: folder.id,
    name: folder.name,
    path: computeFolderPath(folder, allFolders),
    parentId: folder.parentId ?? null,
    createdAt: folder.createdAt instanceof Date ? folder.createdAt.getTime() : folder.createdAt,
    color: folder.color ?? null,
    entityKind: folder.entityKind ?? null,
    entitySubtype: folder.entitySubtype ?? null,
    entityLabel: folder.entityLabel ?? null,
    isTypedRoot: folder.isTypedRoot ?? false,
    isSubtypeRoot: folder.isSubtypeRoot ?? false,
    inheritedKind: folder.inheritedKind ?? null,
    inheritedSubtype: folder.inheritedSubtype ?? null,
  };
}

export function fromSyncFolder(syncFolder: SyncFolder): Folder {
  return {
    id: syncFolder.id,
    name: syncFolder.name,
    parentId: syncFolder.parentId ?? undefined,
    createdAt: new Date(syncFolder.createdAt),
    color: syncFolder.color ?? undefined,
    entityKind: syncFolder.entityKind ?? undefined,
    entitySubtype: syncFolder.entitySubtype ?? undefined,
    entityLabel: syncFolder.entityLabel ?? undefined,
    isTypedRoot: syncFolder.isTypedRoot,
    isSubtypeRoot: syncFolder.isSubtypeRoot,
    inheritedKind: syncFolder.inheritedKind ?? undefined,
    inheritedSubtype: syncFolder.inheritedSubtype ?? undefined,
  };
}

export function parseNoteRow(row: unknown[]): SyncNote {
  const [
    id,
    title,
    contentJson,
    contentText,
    folderId,
    createdAt,
    updatedAt,
    entityKind,
    entitySubtype,
    entityLabel,
    isCanonicalEntity,
    isPinned,
    isFavorite,
    tags,
  ] = row;

  return {
    id: id as string,
    title: title as string,
    content: typeof contentJson === 'string' ? contentJson : JSON.stringify(contentJson || {}),
    contentText: (contentText as string) || '',
    folderId: (folderId as string) || null,
    createdAt: createdAt as number,
    updatedAt: updatedAt as number,
    entityKind: (entityKind as SyncNote['entityKind']) || null,
    entitySubtype: (entitySubtype as string) || null,
    entityLabel: (entityLabel as string) || null,
    isCanonicalEntity: Boolean(isCanonicalEntity),
    isPinned: Boolean(isPinned),
    isFavorite: Boolean(isFavorite),
    tags: Array.isArray(tags) ? tags : [],
  };
}

export function parseFolderRow(row: unknown[]): SyncFolder {
  const [
    id,
    name,
    path,
    parentId,
    createdAt,
    color,
    entityKind,
    entitySubtype,
    entityLabel,
    isTypedRoot,
    isSubtypeRoot,
    inheritedKind,
    inheritedSubtype,
  ] = row;

  return {
    id: id as string,
    name: name as string,
    path: (path as string) || '/',
    parentId: (parentId as string) || null,
    createdAt: createdAt as number,
    color: (color as string) || null,
    entityKind: (entityKind as SyncFolder['entityKind']) || null,
    entitySubtype: (entitySubtype as string) || null,
    entityLabel: (entityLabel as string) || null,
    isTypedRoot: Boolean(isTypedRoot),
    isSubtypeRoot: Boolean(isSubtypeRoot),
    inheritedKind: (inheritedKind as SyncFolder['inheritedKind']) || null,
    inheritedSubtype: (inheritedSubtype as string) || null,
  };
}

export function parseEntityRow(row: unknown[]): SyncEntity {
  const [
    id,
    name,
    normalizedName,
    entityKind,
    entitySubtype,
    groupId,
    scopeType,
    createdAt,
    extractionMethod,
    summary,
    aliases,
    canonicalNoteId,
    frequency,
    source,
    confidence,
    blueprintTypeId,
    blueprintVersionId,
    blueprintFields,
    provenanceData,
    alternateTypes,
  ] = row;

  return {
    id: id as string,
    name: name as string,
    normalizedName: (normalizedName as string) || (name as string).toLowerCase().trim(),
    entityKind: entityKind as string,
    entitySubtype: (entitySubtype as string) || null,
    groupId: groupId as string,
    scopeType: scopeType as 'note' | 'folder' | 'vault',
    createdAt: createdAt as number,
    extractionMethod: (extractionMethod as 'regex' | 'llm' | 'manual') || 'regex',
    summary: (summary as string) || null,
    aliases: Array.isArray(aliases) ? aliases : [],
    canonicalNoteId: (canonicalNoteId as string) || null,
    frequency: (frequency as number) || 1,
    source: (source as EntitySource) || 'manual',
    confidence: (confidence as number) ?? 1.0,
    blueprintTypeId: (blueprintTypeId as string) || null,
    blueprintVersionId: (blueprintVersionId as string) || null,
    blueprintFields: deserializeBlueprintFields(blueprintFields),
    provenanceData: deserializeProvenanceData(provenanceData),
    alternateTypes: deserializeAlternateTypes(alternateTypes),
  };
}

export function serializeProvenanceData(data: ProvenanceRecord[] | null | undefined): unknown {
  if (!data || data.length === 0) return null;
  return data;
}

export function deserializeProvenanceData(data: unknown): ProvenanceRecord[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as ProvenanceRecord[];
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function serializeAlternateTypes(data: AlternateTypeInterpretation[] | null | undefined): unknown {
  if (!data || data.length === 0) return null;
  return data;
}

export function deserializeAlternateTypes(data: unknown): AlternateTypeInterpretation[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as AlternateTypeInterpretation[];
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function serializeBlueprintFields(data: Record<string, unknown> | null | undefined): unknown {
  if (!data) return null;
  return data;
}

export function deserializeBlueprintFields(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  if (typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function parseEdgeRow(row: unknown[]): SyncEdge {
  const [
    id,
    sourceId,
    targetId,
    createdAt,
    validAt,
    invalidAt,
    groupId,
    scopeType,
    edgeType,
    fact,
    episodeIds,
    noteIds,
    weight,
    confidence,
  ] = row;

  return {
    id: id as string,
    sourceId: sourceId as string,
    targetId: targetId as string,
    createdAt: createdAt as number,
    validAt: validAt as number,
    invalidAt: (invalidAt as number) || null,
    groupId: groupId as string,
    scopeType: scopeType as 'note' | 'folder' | 'vault',
    edgeType: (edgeType as string) || 'co_occurrence',
    fact: (fact as string) || null,
    episodeIds: Array.isArray(episodeIds) ? episodeIds : [],
    noteIds: Array.isArray(noteIds) ? noteIds : [],
    weight: (weight as number) || 1,
    confidence: (confidence as number) || 1,
  };
}
