import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { loadFromStorage, saveToStorage, exportNotes, importNotes } from '@/lib/storage';
import type { DocumentConnections, EntityKind } from '@/lib/entities/entityTypes';
import { parseEntityFromTitle, parseFolderEntityFromName } from '@/lib/entities/titleParser';
import { migrateExistingNotes, migrateExistingFolders, needsMigration } from '@/lib/entities/migration';

// Types
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
  // Entity properties
  entityKind?: EntityKind;
  entityLabel?: string;
  isEntity?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  color?: string;
  createdAt: Date;
  // Entity properties
  entityKind?: EntityKind;
  entityLabel?: string;
  isTypedRoot?: boolean;
  inheritedKind?: EntityKind;
}

// Helper type for building folder tree
export interface FolderWithChildren extends Folder {
  subfolders: FolderWithChildren[];
  notes: Note[];
}

// Snapshot for history (minimal data for undo/redo)
interface HistorySnapshot {
  notes: Note[];
  folders: Folder[];
  selectedNoteId: string | null;
}

interface NotesState {
  notes: Note[];
  folders: Folder[];
  selectedNoteId: string | null;
  searchQuery: string;
  isSaving: boolean;
  lastSaved: Date | null;
  // History for undo/redo
  history: HistorySnapshot[];
  historyIndex: number;
}

type NotesAction =
  | { type: 'SET_NOTES'; payload: Note[] }
  | { type: 'SET_FOLDERS'; payload: Folder[] }
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'UPDATE_NOTE'; payload: { id: string; updates: Partial<Note> } }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'SELECT_NOTE'; payload: string | null }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_LAST_SAVED'; payload: Date }
  | { type: 'ADD_FOLDER'; payload: Folder }
  | { type: 'UPDATE_FOLDER'; payload: { id: string; updates: Partial<Folder> } }
  | { type: 'DELETE_FOLDER'; payload: string }
  | { type: 'PUSH_HISTORY' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'IMPORT_DATA'; payload: { notes: Note[]; folders: Folder[] } };

const MAX_HISTORY = 50;

const initialState: NotesState = {
  notes: [],
  folders: [],
  selectedNoteId: null,
  searchQuery: '',
  isSaving: false,
  lastSaved: null,
  history: [],
  historyIndex: -1,
};

// Create a snapshot of current state for history
function createSnapshot(state: NotesState): HistorySnapshot {
  return {
    notes: state.notes.map(n => ({ ...n })),
    folders: state.folders.map(f => ({ ...f })),
    selectedNoteId: state.selectedNoteId,
  };
}

function notesReducer(state: NotesState, action: NotesAction): NotesState {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'SET_FOLDERS':
      return { ...state, folders: action.payload };
    case 'ADD_NOTE':
      return { ...state, notes: [action.payload, ...state.notes] };
    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id === action.payload.id
            ? { ...note, ...action.payload.updates, updatedAt: new Date() }
            : note
        ),
      };
    case 'DELETE_NOTE':
      return {
        ...state,
        notes: state.notes.filter((note) => note.id !== action.payload),
        selectedNoteId:
          state.selectedNoteId === action.payload ? null : state.selectedNoteId,
      };
    case 'SELECT_NOTE':
      return { ...state, selectedNoteId: action.payload };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };
    case 'SET_LAST_SAVED':
      return { ...state, lastSaved: action.payload };
    case 'ADD_FOLDER':
      return { ...state, folders: [...state.folders, action.payload] };
    case 'UPDATE_FOLDER':
      return {
        ...state,
        folders: state.folders.map((folder) =>
          folder.id === action.payload.id
            ? { ...folder, ...action.payload.updates }
            : folder
        ),
      };
    case 'DELETE_FOLDER':
      return {
        ...state,
        folders: state.folders.filter((f) => f.id !== action.payload),
        notes: state.notes.filter((n) => n.folderId !== action.payload),
      };
    case 'PUSH_HISTORY': {
      const newHistory = [
        ...state.history.slice(0, state.historyIndex + 1),
        createSnapshot(state),
      ].slice(-MAX_HISTORY);
      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }
    case 'UNDO': {
      if (state.historyIndex < 0) return state;
      const snapshot = state.history[state.historyIndex];
      if (!snapshot) return state;
      return {
        ...state,
        notes: snapshot.notes,
        folders: snapshot.folders,
        selectedNoteId: snapshot.selectedNoteId,
        historyIndex: state.historyIndex - 1,
      };
    }
    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const snapshot = state.history[state.historyIndex + 2];
      if (!snapshot) return state;
      return {
        ...state,
        notes: snapshot.notes,
        folders: snapshot.folders,
        selectedNoteId: snapshot.selectedNoteId,
        historyIndex: state.historyIndex + 1,
      };
    }
    case 'IMPORT_DATA':
      return {
        ...state,
        notes: action.payload.notes,
        folders: action.payload.folders,
      };
    default:
      return state;
  }
}

// Build folder tree from flat list
function buildFolderTree(folders: Folder[], notes: Note[]): FolderWithChildren[] {
  const folderMap = new Map<string, FolderWithChildren>();
  
  folders.forEach((folder) => {
    folderMap.set(folder.id, { ...folder, subfolders: [], notes: [] });
  });
  
  notes.forEach((note) => {
    if (note.folderId && folderMap.has(note.folderId)) {
      folderMap.get(note.folderId)!.notes.push(note);
    }
  });
  
  const rootFolders: FolderWithChildren[] = [];
  folderMap.forEach((folder) => {
    if (folder.parentId && folderMap.has(folder.parentId)) {
      folderMap.get(folder.parentId)!.subfolders.push(folder);
    } else {
      rootFolders.push(folder);
    }
  });
  
  return rootFolders;
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
  createNote: (folderId?: string, title?: string) => Note;
  getEntityNote: (kind: EntityKind, label: string) => Note | undefined;
  updateNote: (id: string, updates: Partial<Note>) => void;
  updateNoteContent: (id: string, content: string) => void;
  deleteNote: (id: string) => void;
  selectNote: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  createFolder: (name: string, parentId?: string) => Folder;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  undo: () => void;
  redo: () => void;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
}

const NotesContext = createContext<NotesContextValue | null>(null);

export function NotesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notesReducer, initialState);

  // Load initial data with migration
  useEffect(() => {
    let { notes, folders } = loadFromStorage();
    
    // Run migration if needed
    if (needsMigration(notes, folders)) {
      console.log('Migrating notes and folders to entity model...');
      notes = migrateExistingNotes(notes);
      folders = migrateExistingFolders(folders);
    }
    
    dispatch({ type: 'SET_NOTES', payload: notes });
    dispatch({ type: 'SET_FOLDERS', payload: folders });
  }, []);

  // Auto-save with backup
  useEffect(() => {
    if (state.notes.length > 0 || state.folders.length > 0) {
      const timeoutId = setTimeout(() => {
        dispatch({ type: 'SET_SAVING', payload: true });
        saveToStorage(state.notes, state.folders);
        dispatch({ type: 'SET_SAVING', payload: false });
        dispatch({ type: 'SET_LAST_SAVED', payload: new Date() });
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [state.notes, state.folders]);

  // Multi-tab sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'networked-notes-data' && e.newValue) {
        try {
          const { notes, folders } = JSON.parse(e.newValue);
          // Merge: keep whichever was updated more recently
          const mergedNotes = notes.map((externalNote: Note) => {
            const localNote = state.notes.find(n => n.id === externalNote.id);
            if (!localNote) return externalNote;
            return new Date(externalNote.updatedAt) > new Date(localNote.updatedAt)
              ? externalNote
              : localNote;
          });
          dispatch({ type: 'SET_NOTES', payload: mergedNotes });
          dispatch({ type: 'SET_FOLDERS', payload: folders });
        } catch (e) {
          console.error('Failed to sync from other tab:', e);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [state.notes]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        // Only handle global undo if not in editor
        const activeElement = document.activeElement;
        const isInEditor = activeElement?.closest('.ProseMirror');
        if (isInEditor) return; // Let editor handle its own undo
        
        e.preventDefault();
        if (e.shiftKey) {
          dispatch({ type: 'REDO' });
        } else {
          dispatch({ type: 'UNDO' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Memoized computed values
  const selectedNote = useMemo(
    () => state.notes.find((n) => n.id === state.selectedNoteId) || null,
    [state.notes, state.selectedNoteId]
  );

  const filteredNotes = useMemo(() => {
    if (!state.searchQuery) return state.notes;
    const query = state.searchQuery.toLowerCase();
    return state.notes.filter((note) =>
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [state.notes, state.searchQuery]);

  const folderTree = useMemo(
    () => buildFolderTree(state.folders, state.notes),
    [state.folders, state.notes]
  );
  
  const globalNotes = useMemo(
    () => state.notes.filter((note) => !note.folderId),
    [state.notes]
  );
  
  const favoriteNotes = useMemo(
    () => state.notes.filter((note) => note.favorite),
    [state.notes]
  );

  const canUndo = state.historyIndex >= 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  // Helper to get inherited entity kind from folder hierarchy
  const getInheritedKindFromFolder = useCallback((folderId: string): EntityKind | undefined => {
    const folder = state.folders.find(f => f.id === folderId);
    if (!folder) return undefined;
    if (folder.entityKind) return folder.entityKind;
    if (folder.inheritedKind) return folder.inheritedKind;
    if (folder.parentId) return getInheritedKindFromFolder(folder.parentId);
    return undefined;
  }, [state.folders]);

  const createNote = useCallback((folderId?: string, title?: string): Note => {
    dispatch({ type: 'PUSH_HISTORY' });
    
    // Determine title and entity properties
    let noteTitle = title || 'Untitled Note';
    let entityKind: EntityKind | undefined;
    let entityLabel: string | undefined;
    let isEntity = false;
    
    // Parse title for entity syntax
    const parsed = parseEntityFromTitle(noteTitle);
    if (parsed && parsed.label) {
      entityKind = parsed.kind;
      entityLabel = parsed.label;
      isEntity = true;
    } else if (folderId) {
      // If in a typed folder, inherit the kind context (but note is not an entity itself)
      const inheritedKind = getInheritedKindFromFolder(folderId);
      if (inheritedKind && !parsed) {
        // Could suggest entity title, but for now just track context
        entityKind = undefined; // Note is not typed, just in a typed folder
      }
    }
    
    const newNote: Note = {
      id: uuidv4(),
      title: noteTitle,
      content: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [] }],
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
      folderId,
      tags: [],
      isPinned: false,
      entityKind,
      entityLabel,
      isEntity,
    };
    dispatch({ type: 'ADD_NOTE', payload: newNote });
    dispatch({ type: 'SELECT_NOTE', payload: newNote.id });
    return newNote;
  }, [getInheritedKindFromFolder]);


  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    // If title is being updated, re-parse entity properties
    if (updates.title !== undefined) {
      const parsed = parseEntityFromTitle(updates.title);
      if (parsed && parsed.label) {
        updates.entityKind = parsed.kind;
        updates.entityLabel = parsed.label;
        updates.isEntity = true;
      } else {
        updates.entityKind = undefined;
        updates.entityLabel = undefined;
        updates.isEntity = false;
      }
    }
    dispatch({ type: 'UPDATE_NOTE', payload: { id, updates } });
  }, []);

  const updateNoteContent = useCallback((id: string, content: string) => {
    // NO LONGER extract title from content - titles are explicit
    dispatch({ type: 'UPDATE_NOTE', payload: { id, updates: { content } } });
  }, []);

  const deleteNote = useCallback((id: string) => {
    dispatch({ type: 'PUSH_HISTORY' });
    dispatch({ type: 'DELETE_NOTE', payload: id });
  }, []);

  const selectNote = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_NOTE', payload: id });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH', payload: query });
  }, []);

  const createFolder = useCallback((name: string, parentId?: string): Folder => {
    dispatch({ type: 'PUSH_HISTORY' });
    
    // Parse folder name for entity properties
    const parsed = parseFolderEntityFromName(name);
    let inheritedKind: EntityKind | undefined;
    
    // Get inherited kind from parent
    if (parentId) {
      inheritedKind = getInheritedKindFromFolder(parentId);
    }
    
    const newFolder: Folder = {
      id: uuidv4(),
      name: name || 'New Folder',
      parentId,
      createdAt: new Date(),
      entityKind: parsed?.kind,
      entityLabel: parsed?.label,
      isTypedRoot: parsed?.isTypedRoot ?? false,
      inheritedKind,
    };
    dispatch({ type: 'ADD_FOLDER', payload: newFolder });
    return newFolder;
  }, [getInheritedKindFromFolder]);

  const updateFolder = useCallback((id: string, updates: Partial<Folder>) => {
    // If name is being updated, re-parse entity properties
    if (updates.name !== undefined) {
      const parsed = parseFolderEntityFromName(updates.name);
      if (parsed) {
        updates.entityKind = parsed.kind;
        updates.entityLabel = parsed.label;
        updates.isTypedRoot = parsed.isTypedRoot;
      } else {
        updates.entityKind = undefined;
        updates.entityLabel = undefined;
        updates.isTypedRoot = false;
      }
    }
    dispatch({ type: 'UPDATE_FOLDER', payload: { id, updates } });
  }, []);


  const deleteFolder = useCallback((id: string) => {
    dispatch({ type: 'PUSH_HISTORY' });
    dispatch({ type: 'DELETE_FOLDER', payload: id });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const exportData = useCallback(() => {
    exportNotes(state.notes, state.folders);
  }, [state.notes, state.folders]);

  const importDataFn = useCallback(async (file: File) => {
    dispatch({ type: 'PUSH_HISTORY' });
    const data = await importNotes(file);
    dispatch({ type: 'IMPORT_DATA', payload: data });
  }, []);

  // Find canonical entity note by kind and label
  const getEntityNote = useCallback((kind: EntityKind, label: string): Note | undefined => {
    return state.notes.find(
      note => note.isEntity && note.entityKind === kind && note.entityLabel === label
    );
  }, [state.notes]);

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
        setSearchQuery,
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
