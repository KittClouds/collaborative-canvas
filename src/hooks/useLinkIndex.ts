import { useEffect, useMemo, useCallback, useRef } from 'react';
import { linkIndex, type BacklinkInfo, type WikiLink } from '@/lib/linking/LinkIndex';
import type { Note } from '@/contexts/NotesContext';

/**
 * Hook to manage the link index and provide link-related functions
 */
export function useLinkIndex(notes: Note[]) {
  const previousNotesRef = useRef<string>('');

  // Rebuild index when notes change (debounced via dependency comparison)
  useEffect(() => {
    // Simple hash to detect meaningful changes
    const notesHash = notes.map(n => `${n.id}:${n.title}:${n.content.slice(0, 100)}`).join('|');
    
    if (notesHash !== previousNotesRef.current) {
      previousNotesRef.current = notesHash;
      linkIndex.rebuildIndex(notes);
    }
  }, [notes]);

  // Get backlinks for a specific note
  const getBacklinks = useCallback((note: Note | null): BacklinkInfo[] => {
    if (!note) return [];
    return linkIndex.getBacklinksForNote(note);
  }, []);

  // Get outgoing links from a specific note
  const getOutgoingLinks = useCallback((noteId: string): WikiLink[] => {
    return linkIndex.getOutgoingLinks(noteId);
  }, []);

  // Find a note by title
  const findNoteByTitle = useCallback((title: string): Note | undefined => {
    return linkIndex.findNoteByTitle(title, notes);
  }, [notes]);

  // Check if a note exists
  const noteExists = useCallback((title: string): boolean => {
    return linkIndex.noteExists(title, notes);
  }, [notes]);

  return {
    getBacklinks,
    getOutgoingLinks,
    findNoteByTitle,
    noteExists,
  };
}

export default useLinkIndex;
