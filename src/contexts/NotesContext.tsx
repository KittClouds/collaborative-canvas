import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

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
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: Date;
}

interface NotesState {
  notes: Note[];
  folders: Folder[];
  selectedNoteId: string | null;
  searchQuery: string;
  isSaving: boolean;
  lastSaved: Date | null;
}

type NotesAction =
  | { type: 'SET_NOTES'; payload: Note[] }
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'UPDATE_NOTE'; payload: { id: string; updates: Partial<Note> } }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'SELECT_NOTE'; payload: string | null }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_LAST_SAVED'; payload: Date }
  | { type: 'ADD_FOLDER'; payload: Folder }
  | { type: 'DELETE_FOLDER'; payload: string };

const initialState: NotesState = {
  notes: [],
  folders: [],
  selectedNoteId: null,
  searchQuery: '',
  isSaving: false,
  lastSaved: null,
};

function notesReducer(state: NotesState, action: NotesAction): NotesState {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
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
    case 'DELETE_FOLDER':
      return {
        ...state,
        folders: state.folders.filter((f) => f.id !== action.payload),
      };
    default:
      return state;
  }
}

interface NotesContextValue {
  state: NotesState;
  selectedNote: Note | null;
  filteredNotes: Note[];
  createNote: (folderId?: string) => Note;
  updateNote: (id: string, updates: Partial<Note>) => void;
  updateNoteContent: (id: string, content: string) => void;
  deleteNote: (id: string) => void;
  selectNote: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  createFolder: (name: string, parentId?: string) => Folder;
  deleteFolder: (id: string) => void;
}

const NotesContext = createContext<NotesContextValue | null>(null);

const STORAGE_KEY = 'networked-notes-data';

// Load from localStorage
function loadFromStorage(): { notes: Note[]; folders: Folder[] } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        notes: parsed.notes.map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.updatedAt),
        })),
        folders: parsed.folders.map((f: any) => ({
          ...f,
          createdAt: new Date(f.createdAt),
        })),
      };
    }
  } catch (e) {
    console.error('Failed to load notes from storage:', e);
  }
  return { notes: [], folders: [] };
}

// Save to localStorage
function saveToStorage(notes: Note[], folders: Folder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, folders }));
  } catch (e) {
    console.error('Failed to save notes to storage:', e);
  }
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(notesReducer, initialState);

  // Load initial data
  useEffect(() => {
    const { notes, folders } = loadFromStorage();
    if (notes.length > 0) {
      dispatch({ type: 'SET_NOTES', payload: notes });
    }
    folders.forEach((folder) => {
      dispatch({ type: 'ADD_FOLDER', payload: folder });
    });
  }, []);

  // Auto-save on changes
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

  const selectedNote = state.notes.find((n) => n.id === state.selectedNoteId) || null;

  const filteredNotes = state.notes.filter((note) => {
    if (!state.searchQuery) return true;
    const query = state.searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const createNote = useCallback((folderId?: string): Note => {
    const newNote: Note = {
      id: uuidv4(),
      title: 'Untitled Note',
      content: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [] }],
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
      folderId,
      tags: [],
      isPinned: false,
    };
    dispatch({ type: 'ADD_NOTE', payload: newNote });
    dispatch({ type: 'SELECT_NOTE', payload: newNote.id });
    return newNote;
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    dispatch({ type: 'UPDATE_NOTE', payload: { id, updates } });
  }, []);

  const updateNoteContent = useCallback((id: string, content: string) => {
    // Extract title from content if it's JSON
    let title = 'Untitled Note';
    try {
      const parsed = JSON.parse(content);
      if (parsed.content?.[0]?.content?.[0]?.text) {
        title = parsed.content[0].content[0].text.slice(0, 50);
      }
    } catch {
      // Not JSON, try to extract first line
      const firstLine = content.split('\n')[0].slice(0, 50);
      if (firstLine) title = firstLine;
    }
    dispatch({ type: 'UPDATE_NOTE', payload: { id, updates: { content, title } } });
  }, []);

  const deleteNote = useCallback((id: string) => {
    dispatch({ type: 'DELETE_NOTE', payload: id });
  }, []);

  const selectNote = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_NOTE', payload: id });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH', payload: query });
  }, []);

  const createFolder = useCallback((name: string, parentId?: string): Folder => {
    const newFolder: Folder = {
      id: uuidv4(),
      name,
      parentId,
      createdAt: new Date(),
    };
    dispatch({ type: 'ADD_FOLDER', payload: newFolder });
    return newFolder;
  }, []);

  const deleteFolder = useCallback((id: string) => {
    dispatch({ type: 'DELETE_FOLDER', payload: id });
  }, []);

  return (
    <NotesContext.Provider
      value={{
        state,
        selectedNote,
        filteredNotes,
        createNote,
        updateNote,
        updateNoteContent,
        deleteNote,
        selectNote,
        setSearchQuery,
        createFolder,
        deleteFolder,
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
