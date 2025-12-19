import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import type { SyncEngine } from './SyncEngine';
import type { AppState, SyncNote, SyncFolder, GraphProjection } from './types';

const SyncEngineContext = createContext<SyncEngine | null>(null);
const SyncStateContext = createContext<AppState | null>(null);

interface SyncEngineProviderProps {
  engine: SyncEngine;
  children: ReactNode;
}

export function SyncEngineProvider({ engine, children }: SyncEngineProviderProps) {
  const [state, setState] = useState<AppState>(engine.getState());

  useEffect(() => {
    const unsubscribe = engine.subscribe(setState);
    return unsubscribe;
  }, [engine]);

  return (
    <SyncEngineContext.Provider value={engine}>
      <SyncStateContext.Provider value={state}>
        {children}
      </SyncStateContext.Provider>
    </SyncEngineContext.Provider>
  );
}

export function useSyncEngine(): SyncEngine {
  const engine = useContext(SyncEngineContext);
  if (!engine) {
    throw new Error('useSyncEngine must be used within a SyncEngineProvider');
  }
  return engine;
}

export function useSyncState(): AppState {
  const state = useContext(SyncStateContext);
  if (!state) {
    throw new Error('useSyncState must be used within a SyncEngineProvider');
  }
  return state;
}

export function useSyncNotes(): SyncNote[] {
  const state = useSyncState();
  return state.notes;
}

export function useSyncNote(id: string | null): SyncNote | null {
  const state = useSyncState();
  if (!id) return null;
  return state.notesById.get(id) ?? null;
}

export function useSyncFolders(): SyncFolder[] {
  const state = useSyncState();
  return state.folders;
}

export function useSyncFolder(id: string | null): SyncFolder | null {
  const state = useSyncState();
  if (!id) return null;
  return state.foldersById.get(id) ?? null;
}

export function useGraphProjection(): GraphProjection {
  const state = useSyncState();
  return state.graphProjection;
}

export function useIsHydrated(): boolean {
  const state = useSyncState();
  return state.isHydrated;
}

export interface FolderWithChildren extends SyncFolder {
  subfolders: FolderWithChildren[];
  notes: SyncNote[];
}

function buildFolderTreeFromSync(folders: SyncFolder[], notes: SyncNote[]): FolderWithChildren[] {
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

export function useFolderTree(): FolderWithChildren[] {
  const folders = useSyncFolders();
  const notes = useSyncNotes();
  return useMemo(() => buildFolderTreeFromSync(folders, notes), [folders, notes]);
}

export function useGlobalNotes(): SyncNote[] {
  const notes = useSyncNotes();
  return useMemo(() => notes.filter((note) => !note.folderId), [notes]);
}

export function useFavoriteNotes(): SyncNote[] {
  const notes = useSyncNotes();
  return useMemo(() => notes.filter((note) => note.isFavorite), [notes]);
}

export function usePinnedNotes(): SyncNote[] {
  const notes = useSyncNotes();
  return useMemo(() => notes.filter((note) => note.isPinned), [notes]);
}

export function useFilteredNotes(searchQuery: string): SyncNote[] {
  const notes = useSyncNotes();
  return useMemo(() => {
    if (!searchQuery) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(q) ||
        note.contentText.toLowerCase().includes(q) ||
        note.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [notes, searchQuery]);
}
