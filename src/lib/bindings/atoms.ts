/**
 * Field Bindings Atoms
 * 
 * Jotai atoms for managing field bindings state.
 */

import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { bindingEngine } from './BindingEngine';
import type {
    FieldBinding,
    CreateBindingOptions,
    UpdateBindingOptions,
    BindingChangeEvent,
} from './types';

// ============================================
// INITIALIZATION
// ============================================

/**
 * Atom to track initialization state
 */
export const bindingEngineInitializedAtom = atom(false);

/**
 * Atom to initialize the binding engine
 */
export const initializeBindingEngineAtom = atom(
    null,
    async (get, set) => {
        if (get(bindingEngineInitializedAtom)) return;

        try {
            await bindingEngine.initialize();
            set(bindingEngineInitializedAtom, true);
        } catch (error) {
            console.error('[BindingAtoms] Failed to initialize binding engine:', error);
            throw error;
        }
    }
);

// ============================================
// BINDING QUERIES
// ============================================

/**
 * Get all bindings
 */
export const allBindingsAtom = atom<FieldBinding[]>((get) => {
    get(bindingEngineInitializedAtom); // Dependency for reactivity
    return bindingEngine.getAllBindings();
});

/**
 * Get bindings for a specific entity
 */
export const entityBindingsFamily = atomFamily((entityId: string) =>
    atom<FieldBinding[]>((get) => {
        get(bindingEngineInitializedAtom);
        return bindingEngine.getBindingsForEntity(entityId);
    })
);

/**
 * Get bindings where a field is the source (receives value)
 */
export const sourceBindingsFamily = atomFamily(
    (params: { entityId: string; fieldName: string }) =>
        atom<FieldBinding[]>((get) => {
            get(bindingEngineInitializedAtom);
            return bindingEngine.getBindingsForSource(params.entityId, params.fieldName);
        })
);

/**
 * Get bindings where a field is the target (provides value)
 */
export const targetBindingsFamily = atomFamily(
    (params: { entityId: string; fieldName: string }) =>
        atom<FieldBinding[]>((get) => {
            get(bindingEngineInitializedAtom);
            return bindingEngine.getBindingsForTarget(params.entityId, params.fieldName);
        })
);

/**
 * Check if a field has any bindings
 */
export const hasBindingsFamily = atomFamily(
    (params: { entityId: string; fieldName: string }) =>
        atom<boolean>((get) => {
            get(bindingEngineInitializedAtom);
            return bindingEngine.hasBindings(params.entityId, params.fieldName);
        })
);

// ============================================
// BINDING MUTATIONS
// ============================================

/**
 * Create a new binding
 */
export const createBindingAtom = atom(
    null,
    async (get, set, options: CreateBindingOptions): Promise<FieldBinding> => {
        // Ensure initialized
        if (!get(bindingEngineInitializedAtom)) {
            await set(initializeBindingEngineAtom);
        }

        const binding = await bindingEngine.createBinding(options);

        // Trigger reactivity update
        set(bindingVersionAtom, (v) => v + 1);

        return binding;
    }
);

/**
 * Update a binding
 */
export const updateBindingAtom = atom(
    null,
    async (get, set, params: { bindingId: string; updates: UpdateBindingOptions }): Promise<FieldBinding | null> => {
        const binding = await bindingEngine.updateBinding(params.bindingId, params.updates);

        if (binding) {
            set(bindingVersionAtom, (v) => v + 1);
        }

        return binding;
    }
);

/**
 * Delete a binding
 */
export const deleteBindingAtom = atom(
    null,
    async (get, set, bindingId: string): Promise<boolean> => {
        const deleted = await bindingEngine.deleteBinding(bindingId);

        if (deleted) {
            set(bindingVersionAtom, (v) => v + 1);
        }

        return deleted;
    }
);

// ============================================
// REACTIVITY HELPERS
// ============================================

/**
 * Version counter to trigger re-renders when bindings change
 */
const bindingVersionAtom = atom(0);

/**
 * Version atom exposed for subscriptions
 */
export const bindingChangeVersionAtom = atom((get) => get(bindingVersionAtom));

// ============================================
// EVENT SUBSCRIPTION
// ============================================

/**
 * Subscribe to binding change events
 */
export const subscribeToBindingEventsAtom = atom(
    null,
    (get, set, callback: (event: BindingChangeEvent) => void): (() => void) => {
        return bindingEngine.subscribe(callback);
    }
);

// ============================================
// CONVENIENCE ATOMS
// ============================================

/**
 * Get binding count
 */
export const bindingCountAtom = atom((get) => {
    get(bindingVersionAtom);
    get(bindingEngineInitializedAtom);
    return bindingEngine.getAllBindings().length;
});

/**
 * Check if a potential binding would create a cycle
 */
export const wouldCreateCycleAtom = atom(
    null,
    (get, set, params: {
        sourceEntityId: string;
        sourceFieldName: string;
        targetEntityId: string;
        targetFieldName: string;
    }): boolean => {
        return bindingEngine.wouldCreateCycle(
            params.sourceEntityId,
            params.sourceFieldName,
            params.targetEntityId,
            params.targetFieldName
        );
    }
);
