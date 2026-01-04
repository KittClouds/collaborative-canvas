/**
 * unified-scanner-utils.ts
 * 
 * Utility functions for the Unified Scanner (Rust WASM)
 * 
 * IMPORTANT WASM SERIALIZATION QUIRKS:
 * -------------------------------------
 * 1. serde_wasm_bindgen serializes Rust HashMap<String, String> as JavaScript Map, NOT plain object
 * 2. std::time::Instant is NOT available in WASM - use instant crate with wasm-bindgen feature
 * 3. String slicing in Rust must be char-boundary safe - always use .get() or .find() for offsets
 * 4. Panics in WASM cause RuntimeError: memory access out of bounds - wrap in catch_unwind
 * 
 * This module provides defensive utilities that handle these quirks.
 */

import { EntityKind, ENTITY_COLORS, ENTITY_KINDS } from '@/lib/types/entityTypes';

/**
 * Captures can be either a Map (from serde_wasm_bindgen) or a plain object
 */
export type CapturesType = Map<string, string> | Record<string, string>;

/**
 * Safely get a capture value from either Map or Object format
 * 
 * serde_wasm_bindgen serializes Rust HashMap as JavaScript Map, not plain object.
 * This helper handles both formats for maximum compatibility.
 * 
 * @param captures - The captures object (Map or Record)
 * @param key - The key to retrieve
 * @returns The value or undefined if not found
 */
export function getCaptureValue(
    captures: CapturesType | undefined | null,
    key: string
): string | undefined {
    if (!captures) return undefined;

    if (captures instanceof Map) {
        return captures.get(key);
    }

    return (captures as Record<string, string>)[key];
}

/**
 * Safely get entity kind from captures, validated against ENTITY_KINDS
 * 
 * @param captures - The captures object
 * @returns Validated EntityKind or undefined
 */
export function getValidatedEntityKind(
    captures: CapturesType | undefined | null
): EntityKind | undefined {
    const raw = getCaptureValue(captures, 'entityKind');
    if (!raw) return undefined;

    const upper = raw.toUpperCase();
    if (ENTITY_KINDS.includes(upper as EntityKind)) {
        return upper as EntityKind;
    }

    return undefined;
}

/**
 * Get entity color CSS variable name from entity kind
 * 
 * @param entityKind - The entity kind (e.g., 'EVENT', 'CHARACTER')
 * @returns CSS variable name (e.g., '--entity-event')
 */
export function getEntityColorVar(entityKind: EntityKind): string {
    return `--entity-${entityKind.toLowerCase().replace('_', '-')}`;
}

/**
 * Get HSL color string for entity kind
 * 
 * @param entityKind - The entity kind
 * @returns CSS color string using HSL var
 */
export function getEntityColor(entityKind: EntityKind | undefined): string {
    if (!entityKind || !ENTITY_COLORS[entityKind]) {
        return 'hsl(var(--entity-character))'; // Fallback
    }
    return `hsl(var(${getEntityColorVar(entityKind)}))`;
}

/**
 * Get HSL background color string for entity kind (15% opacity)
 * 
 * @param entityKind - The entity kind
 * @returns CSS background color string using HSL var with opacity
 */
export function getEntityBgColor(entityKind: EntityKind | undefined): string {
    if (!entityKind || !ENTITY_COLORS[entityKind]) {
        return 'hsl(var(--entity-character) / 0.15)'; // Fallback
    }
    return `hsl(var(${getEntityColorVar(entityKind)}) / 0.15)`;
}

/**
 * Defensive wrapper for span processing
 * Catches any errors and returns undefined instead of crashing
 */
export function safeProcessSpan<T>(
    processor: () => T,
    fallback: T,
    logError = true
): T {
    try {
        return processor();
    } catch (error) {
        if (logError) {
            console.warn('[UnifiedScanner] Error processing span:', error);
        }
        return fallback;
    }
}

/**
 * Validate RefKind value from Rust
 */
export const VALID_REF_KINDS = [
    'Entity',
    'Wikilink',
    'Backlink',
    'Tag',
    'Mention',
    'Triple',
] as const;

export type ValidRefKind = typeof VALID_REF_KINDS[number];

export function isValidRefKind(kind: unknown): kind is ValidRefKind {
    return typeof kind === 'string' && VALID_REF_KINDS.includes(kind as ValidRefKind);
}
