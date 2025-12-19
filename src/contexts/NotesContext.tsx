import React, { createContext, useContext, useCallback, useMemo, useState, useEffect, ReactNode } from 'react';
import { generateId } from '@/lib/utils/ids';
import { exportNotes, importNotes } from '@/lib/storage';
import type { DocumentConnections, EntityKind } from '@/lib/entities/entityTypes';
import { parseEntityFromTitle, parseFolderEntityFromName } from '@/lib/entities/titleParser';
import { NARRATIVE_FOLDER_CONFIGS } from '@/lib/templates/narrativeTemplates';
import {
  useSyncEngine,
  useSyncNotes,
  useSyncFolders,
  useFolderTree as useSyncFolderTree,
  fromSyncNote,
  fromSyncFolder,
  type SyncNote,
  type FolderWithChildren as SyncFolderWithChildren,
} from '@/lib/sync';

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  folderId?: string;
  tags: string[];
  isPinned: boolean;
  favorite?: boolean;
  connections?: DocumentConnections;
  entityKind?: EntityKind;
  entitySubtype?: string;
  entityLabel?: string;
  isEntity?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  color?: string;
  createdAt: Date;
  entityKind?: EntityKind;
  entitySubtype?: string;
  entityLabel?: string;
  isTypedRoot?: boolean;
  isSubtypeRoot?: boolean;
  inheritedKind?: EntityKind;
  inheritedSubtype?: string;
}

export interface FolderWithChildren extends Folder {
  subfolders: FolderWithChildren[];
  notes: Note[];
}

interface NotesState {
  notes: Note[];
  folders: Folder[];
  selectedNoteId: string | null;
  searchQuery: string;
  isSaving: boolean;
  lastSaved: Date | null;
  history: unknown[];
  historyIndex: number;
}

interface NotesContextValue {
  state: NotesState;
  selectedNote: Note | null;
  filteredNotes: Note[];
  folderTree: FolderWithChildren[];
  globalNotes: Note[];
  favoriteNotes: Note[];
  canUndo: boolean;
  canRedo: boolean;
  createNote: (folderId?: string, title?: string, sourceNoteId?: string) => Note;
  getEntityNote: (kind: EntityKind, label: string) => Note | undefined;
  updateNote: (id: string, updates: Partial<Note>) => void;
  updateNoteContent: (id: string, content: string) => void;
  deleteNote: (id: string) => void;
  selectNote: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  createFolder: (name: string, parentId?: string, options?: Partial<Folder>) => Folder;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  undo: () => void;
  redo: () => void;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
}

const NotesContext = createContext<NotesContextValue | null>(null);

function convertSyncFolderTree(syncTree: SyncFolderWithChildren[]): FolderWithChildren[] {
  return syncTree.map(sf => ({
    ...fromSyncFolder(sf),
    subfolders: convertSyncFolderTree(sf.subfolders),
    notes: sf.notes.map(sn => fromSyncNote(sn)),
  }));
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const engine = useSyncEngine();
  const syncNotes = useSyncNotes();
  const syncFolders = useSyncFolders();
  const syncFolderTree = useSyncFolderTree();

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const notes = useMemo(() => syncNotes.map(fromSyncNote), [syncNotes]);
  const folders = useMemo(() => syncFolders.map(fromSyncFolder), [syncFolders]);

  const state: NotesState = useMemo(() => ({
    notes,
    folders,
    selectedNoteId,
    searchQuery,
    isSaving: engine.hasPendingWrites(),
    lastSaved: null,
    history: [],
    historyIndex: -1,
  }), [notes, folders, selectedNoteId, searchQuery, engine]);

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || null,
    [notes, selectedNoteId]
  );

  const filteredNotes = useMemo(() => {
    if (!searchQuery) return notes;
    const query = searchQuery.toLowerCase();
    return notes.filter((note) =>
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [notes, searchQuery]);

  const folderTree = useMemo(
    () => convertSyncFolderTree(syncFolderTree),
    [syncFolderTree]
  );

  const globalNotes = useMemo(
    () => notes.filter((note) => !note.folderId),
    [notes]
  );

  const favoriteNotes = useMemo(
    () => notes.filter((note) => note.favorite),
    [notes]
  );

  const canUndo = false;
  const canRedo = false;

  const getInheritedKindFromFolder = useCallback((folderId: string): EntityKind | undefined => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return undefined;
    if (folder.entityKind) return folder.entityKind;
    if (folder.inheritedKind) return folder.inheritedKind;
    if (folder.parentId) return getInheritedKindFromFolder(folder.parentId);
    return undefined;
  }, [folders]);

  const getInheritedSubtypeFromFolder = useCallback((folderId: string): string | undefined => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return undefined;
    if (folder.entitySubtype) return folder.entitySubtype;
    if (folder.inheritedSubtype) return folder.inheritedSubtype;
    if (folder.parentId) return getInheritedSubtypeFromFolder(folder.parentId);
    return undefined;
  }, [folders]);

  const createNote = useCallback((folderId?: string, title?: string, sourceNoteId?: string): Note => {
    let noteTitle = title || '';
    let initialContent = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }],
    });

    let entityKind: EntityKind | undefined;
    let entitySubtype: string | undefined;
    let entityLabel: string | undefined;
    let isEntity = false;

    if (folderId && !title) {
      const inheritedKind = getInheritedKindFromFolder(folderId);
      if (inheritedKind && NARRATIVE_FOLDER_CONFIGS[inheritedKind]) {
        noteTitle = NARRATIVE_FOLDER_CONFIGS[inheritedKind].autoPrefix;
        const template = NARRATIVE_FOLDER_CONFIGS[inheritedKind].template;
        if (template) {
          initialContent = JSON.stringify({
            type: 'doc',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: template }] }
            ],
          });
        }
      } else {
        noteTitle = 'Untitled Note';
      }
    } else if (!noteTitle) {
      noteTitle = 'Untitled Note';
    }

    const parsed = parseEntityFromTitle(noteTitle);
    if (parsed && parsed.label) {
      entityKind = parsed.kind;
      entitySubtype = parsed.subtype;
      entityLabel = parsed.label;
      isEntity = true;
    }

    if (sourceNoteId) {
      const sourceNote = notes.find(n => n.id === sourceNoteId);
      if (sourceNote) {
        const backlinkTitle = sourceNote.title;
        initialContent = JSON.stringify({
          type: 'doc',
          content: [
            { 
              type: 'paragraph', 
              content: [
                { type: 'text', text: `<<${backlinkTitle}>>` }
              ] 
            },
            { type: 'paragraph', content: [] }
          ],
        });
      }
    }

    const syncNote = engine.createNote({
      id: generateId(),
      title: noteTitle,
      content: initialContent,
      folderId: folderId ?? null,
      entityKind: entityKind ?? null,
      entitySubtype: entitySubtype ?? null,
      entityLabel: entityLabel ?? null,
      isCanonicalEntity: isEntity,
      isPinned: false,
      isFavorite: false,
      tags: [],
    });

    setSelectedNoteId(syncNote.id);

    return fromSyncNote(syncNote);
  }, [engine, getInheritedKindFromFolder, notes]);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    if (updates.title !== undefined) {
      const parsed = parseEntityFromTitle(updates.title);
      if (parsed && parsed.label) {
        updates.entityKind = parsed.kind;
        updates.entitySubtype = parsed.subtype;
        updates.entityLabel = parsed.label;
        updates.isEntity = true;
      } else {
        updates.entityKind = undefined;
        updates.entitySubtype = undefined;
        updates.entityLabel = undefined;
        updates.isEntity = false;
      }
    }

    const patch: Partial<SyncNote> = {};
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.content !== undefined) patch.content = updates.content;
    if (updates.folderId !== undefined) patch.folderId = updates.folderId ?? null;
    if (updates.tags !== undefined) patch.tags = updates.tags;
    if (updates.isPinned !== undefined) patch.isPinned = updates.isPinned;
    if (updates.favorite !== undefined) patch.isFavorite = updates.favorite;
    if (updates.entityKind !== undefined) patch.entityKind = updates.entityKind ?? null;
    if (updates.entitySubtype !== undefined) patch.entitySubtype = updates.entitySubtype ?? null;
    if (updates.entityLabel !== undefined) patch.entityLabel = updates.entityLabel ?? null;
    if (updates.isEntity !== undefined) patch.isCanonicalEntity = updates.isEntity;

    engine.updateNote(id, patch);
  }, [engine]);

  const updateNoteContent = useCallback((id: string, content: string) => {
    engine.updateNote(id, { content });
  }, [engine]);

  const deleteNote = useCallback((id: string) => {
    engine.deleteNote(id);
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
    }
  }, [engine, selectedNoteId]);

  const selectNote = useCallback((id: string | null) => {
    setSelectedNoteId(id);
  }, []);

  const setSearchQueryFn = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const createFolder = useCallback((name: string, parentId?: string, options?: Partial<Folder>): Folder => {
    const parsed = parseFolderEntityFromName(name);
    let inheritedKind: EntityKind | undefined;
    let inheritedSubtype: string | undefined;

    if (parentId) {
      inheritedKind = getInheritedKindFromFolder(parentId);
      inheritedSubtype = getInheritedSubtypeFromFolder(parentId);
    }

    const syncFolder = engine.createFolder({
      id: generateId(),
      name: name || 'New Folder',
      parentId: parentId ?? null,
      color: options?.color ?? null,
      entityKind: options?.entityKind ?? parsed?.kind ?? null,
      entitySubtype: options?.entitySubtype ?? parsed?.subtype ?? null,
      entityLabel: options?.entityLabel ?? parsed?.label ?? null,
      isTypedRoot: options?.isTypedRoot ?? parsed?.isTypedRoot ?? false,
      isSubtypeRoot: options?.isSubtypeRoot ?? parsed?.isSubtypeRoot ?? false,
      inheritedKind: inheritedKind ?? null,
      inheritedSubtype: inheritedSubtype ?? null,
    });

    return fromSyncFolder(syncFolder);
  }, [engine, getInheritedKindFromFolder, getInheritedSubtypeFromFolder]);

  const updateFolder = useCallback((id: string, updates: Partial<Folder>) => {
    if (updates.name !== undefined) {
      const parsed = parseFolderEntityFromName(updates.name);
      if (parsed) {
        updates.entityKind = parsed.kind;
        updates.entitySubtype = parsed.subtype;
        updates.entityLabel = parsed.label;
        updates.isTypedRoot = parsed.isTypedRoot;
        updates.isSubtypeRoot = parsed.isSubtypeRoot;
      } else {
        updates.entityKind = undefined;
        updates.entitySubtype = undefined;
        updates.entityLabel = undefined;
        updates.isTypedRoot = false;
        updates.isSubtypeRoot = false;
      }
    }

    engine.updateFolder(id, {
      name: updates.name,
      parentId: updates.parentId ?? null,
      color: updates.color ?? null,
      entityKind: updates.entityKind ?? null,
      entitySubtype: updates.entitySubtype ?? null,
      entityLabel: updates.entityLabel ?? null,
      isTypedRoot: updates.isTypedRoot ?? false,
      isSubtypeRoot: updates.isSubtypeRoot ?? false,
      inheritedKind: updates.inheritedKind ?? null,
      inheritedSubtype: updates.inheritedSubtype ?? null,
    });
  }, [engine]);

  const deleteFolder = useCallback((id: string) => {
    engine.deleteFolder(id);
  }, [engine]);

  const undo = useCallback(() => {
    console.log('Undo not yet implemented in SyncEngine');
  }, []);

  const redo = useCallback(() => {
    console.log('Redo not yet implemented in SyncEngine');
  }, []);

  const exportData = useCallback(() => {
    exportNotes(notes, folders);
  }, [notes, folders]);

  const importDataFn = useCallback(async (file: File) => {
    const data = await importNotes(file);
    for (const folder of data.folders) {
      engine.createFolder({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId ?? null,
        color: folder.color ?? null,
        entityKind: folder.entityKind ?? null,
        entitySubtype: folder.entitySubtype ?? null,
        entityLabel: folder.entityLabel ?? null,
        isTypedRoot: folder.isTypedRoot ?? false,
        isSubtypeRoot: folder.isSubtypeRoot ?? false,
        inheritedKind: folder.inheritedKind ?? null,
        inheritedSubtype: folder.inheritedSubtype ?? null,
      });
    }
    for (const note of data.notes) {
      engine.createNote({
        id: note.id,
        title: note.title,
        content: note.content,
        folderId: note.folderId ?? null,
        entityKind: note.entityKind ?? null,
        entitySubtype: note.entitySubtype ?? null,
        entityLabel: note.entityLabel ?? null,
        isCanonicalEntity: note.isEntity ?? false,
        isPinned: note.isPinned,
        isFavorite: note.favorite ?? false,
        tags: note.tags,
      });
    }
  }, [engine]);

  const getEntityNote = useCallback((kind: EntityKind, label: string): Note | undefined => {
    return notes.find(
      note => note.isEntity && note.entityKind === kind && note.entityLabel === label
    );
  }, [notes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        const activeElement = document.activeElement;
        const isInEditor = activeElement?.closest('.ProseMirror');
        if (isInEditor) return;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <NotesContext.Provider
      value={{
        state,
        selectedNote,
        filteredNotes,
        folderTree,
        globalNotes,
        favoriteNotes,
        canUndo,
        canRedo,
        createNote,
        updateNote,
        updateNoteContent,
        deleteNote,
        selectNote,
        setSearchQuery: setSearchQueryFn,
        createFolder,
        updateFolder,
        deleteFolder,
        undo,
        redo,
        exportData,
        importData: importDataFn,
        getEntityNote,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
}
