/**
 * Hook for triggering network auto-creation checks
 * 
 * Use this hook in components that manage folder operations to
 * automatically create networks when thresholds are met.
 */

import { useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { checkNetworkAutoCreationAtom } from '@/atoms';
import type { NetworkAutoCreateResult } from '@/lib/folders/network-auto-creator';

export interface UseNetworkAutoCreationReturn {
    /**
     * Check if network should be created for a subfolder
     * Call this after adding children to a typed subfolder
     */
    checkNetworkCreation: (subfolderId: string) => Promise<NetworkAutoCreateResult | null>;
}

/**
 * Hook for network auto-creation
 * 
 * Usage:
 * ```tsx
 * const { checkNetworkCreation } = useNetworkAutoCreation();
 * 
 * const handleMoveToFolder = async (noteId, targetFolderId) => {
 *   await moveNote(noteId, targetFolderId);
 *   // Check if this triggers network creation
 *   await checkNetworkCreation(targetFolderId);
 * };
 * ```
 */
export function useNetworkAutoCreation(): UseNetworkAutoCreationReturn {
    const checkAtom = useSetAtom(checkNetworkAutoCreationAtom);

    const checkNetworkCreation = useCallback(
        async (subfolderId: string): Promise<NetworkAutoCreateResult | null> => {
            try {
                return await checkAtom({ subfolderId });
            } catch (error) {
                console.error('[useNetworkAutoCreation] Error:', error);
                return null;
            }
        },
        [checkAtom]
    );

    return {
        checkNetworkCreation,
    };
}
