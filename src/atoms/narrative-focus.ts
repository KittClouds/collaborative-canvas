/**
 * Narrative Focus Atoms
 * 
 * Global state for entity-scoped narrative views.
 * When an entity is focused, all calendar views, todos, and file creation
 * inherit that context.
 */

import { atom, type WritableAtom } from 'jotai';
import type { FantasyDate } from '@/lib/fantasy-calendar/types';
import type { EntityKind } from '@/lib/entities/entityTypes';

// ============================================
// TYPES
// ============================================

/**
 * The currently focused entity and temporal context
 */
export interface NarrativeFocus {
    // Entity focus
    entityId: string | null;
    entityKind: EntityKind | null;
    entityLabel: string | null;

    // Legacy: noteId for backwards compatibility with EntitySelectionContext
    sourceNoteId?: string;
}

/**
 * Mode for how the focus filters content
 */
export type FocusMode = 'all' | 'entity' | 'location' | 'faction';

// ============================================
// BASE ATOMS
// ============================================

const _narrativeFocusBaseAtom = atom<NarrativeFocus>({
    entityId: null,
    entityKind: null,
    entityLabel: null,
    sourceNoteId: undefined,
});

const _focusModeBaseAtom = atom<FocusMode>('all');

// Writable wrapper for type safety
const _narrativeFocusAtom: WritableAtom<NarrativeFocus, [NarrativeFocus], void> = atom(
    (get) => get(_narrativeFocusBaseAtom),
    (_get, set, val) => set(_narrativeFocusBaseAtom as any, val)
);

const _focusModeAtom: WritableAtom<FocusMode, [FocusMode], void> = atom(
    (get) => get(_focusModeBaseAtom),
    (_get, set, val) => set(_focusModeBaseAtom as any, val)
);

// ============================================
// READ ATOMS
// ============================================

/**
 * Full narrative focus state
 */
export const narrativeFocusAtom = atom((get) => get(_narrativeFocusAtom));

/**
 * Current focus mode
 */
export const focusModeAtom = atom((get) => get(_focusModeAtom));

/**
 * Just the focused entity ID (null = show all)
 */
export const focusedEntityIdAtom = atom((get) => get(_narrativeFocusAtom).entityId);

/**
 * Just the focused entity kind
 */
export const focusedEntityKindAtom = atom((get) => get(_narrativeFocusAtom).entityKind);

/**
 * Just the focused entity label
 */
export const focusedEntityLabelAtom = atom((get) => get(_narrativeFocusAtom).entityLabel);

/**
 * Whether any entity is currently focused
 */
export const hasEntityFocusAtom = atom((get) => get(_narrativeFocusAtom).entityId !== null);

// ============================================
// WRITE ATOMS
// ============================================

/**
 * Set the narrative focus to a specific entity
 */
export const setNarrativeFocusAtom = atom(
    null,
    (_get, set, focus: {
        entityId: string;
        entityKind: EntityKind;
        entityLabel: string;
        sourceNoteId?: string;
    }) => {
        set(_narrativeFocusAtom, {
            entityId: focus.entityId,
            entityKind: focus.entityKind,
            entityLabel: focus.entityLabel,
            sourceNoteId: focus.sourceNoteId,
        });
        set(_focusModeAtom, 'entity');
        console.log(`[NarrativeFocus] Entity focus set: ${focus.entityLabel} (${focus.entityKind})`);
    }
);

/**
 * Clear the narrative focus (show all)
 */
export const clearNarrativeFocusAtom = atom(
    null,
    (_get, set) => {
        set(_narrativeFocusAtom, {
            entityId: null,
            entityKind: null,
            entityLabel: null,
            sourceNoteId: undefined,
        });
        set(_focusModeAtom, 'all');
        console.log('[NarrativeFocus] Focus cleared');
    }
);

/**
 * Set focus mode without changing entity
 */
export const setFocusModeAtom = atom(
    null,
    (_get, set, mode: FocusMode) => {
        set(_focusModeAtom, mode);
    }
);
