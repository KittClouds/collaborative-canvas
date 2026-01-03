import { atom } from 'jotai';
import type { Editor } from '@tiptap/react';

/**
 * Atom to hold the active Tiptap editor instance.
 * Allows cross-component access for AI inline editing and other features.
 * 
 * This is a writable atom that can be set to an Editor instance or null.
 */
export const editorInstanceAtom = atom<Editor | null, [Editor | null], void>(
    null, // initial value
    (get, set, update) => set(editorInstanceAtom, update) // write function
);
