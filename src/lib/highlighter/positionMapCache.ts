/**
 * Position Map Cache - Shared between RustSyntaxHighlighter and UnifiedSyntaxHighlighter
 * 
 * M3: Uses WeakMap keyed by ProseMirror doc node to avoid duplicate traversals.
 * When both highlighters run on the same transaction, second one gets free cache hit.
 */

import { Node as ProseMirrorNode } from '@tiptap/pm/model';

interface CachedAnalysis {
    text: string;
    positionMap: number[];
}

// WeakMap: auto-cleanup when doc node is GC'd
const cache = new WeakMap<ProseMirrorNode, CachedAnalysis>();

/**
 * Extract full text AND build position map in ONE traversal.
 * Returns cached result if same doc node.
 */
export function getOrBuildPositionMap(doc: ProseMirrorNode): CachedAnalysis {
    const cached = cache.get(doc);
    if (cached) {
        return cached;
    }

    // Build fresh
    const textParts: string[] = [];
    const positionMap: number[] = [];
    let charOffset = 0;

    doc.descendants((node, pos) => {
        if (node.isText && node.text) {
            textParts.push(node.text);
            for (let i = 0; i < node.text.length; i++) {
                positionMap[charOffset + i] = pos + i;
            }
            charOffset += node.text.length;
        } else if (node.isBlock) {
            textParts.push('\n');
            positionMap[charOffset] = pos;
            charOffset += 1;
        }
    });

    const result: CachedAnalysis = {
        text: textParts.join(''),
        positionMap,
    };

    cache.set(doc, result);
    return result;
}

/**
 * Extract full text only (no position map needed).
 * Still uses cache if available.
 */
export function getOrBuildText(doc: ProseMirrorNode): string {
    const cached = cache.get(doc);
    if (cached) {
        return cached.text;
    }

    // Build full analysis (caches for potential later position map usage)
    return getOrBuildPositionMap(doc).text;
}
