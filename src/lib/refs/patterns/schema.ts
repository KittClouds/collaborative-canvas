/**
 * Pattern Definition Schema
 * 
 * Defines the structure for user-definable regex patterns
 * that power the Ref parsing system.
 */

import type { RefKind } from '../types';

/**
 * Transform function for captured groups
 */
export type TransformFn = (raw: string, context: ParseContext) => string;

/**
 * Validator function for pattern matches
 */
export type ValidatorFn = (match: RegExpMatchArray, context: ParseContext) => boolean;

/**
 * Context passed to transform/validator functions
 */
export interface ParseContext {
    noteId: string;
    fullText: string;
    position: number;
}

/**
 * Capture group mapping
 */
export interface CaptureMapping {
    group: number;           // Which capture group (1-indexed)?
    transform?: TransformFn; // Optional post-processing
    required?: boolean;      // Is this capture required for a valid match?
}

/**
 * Rendering configuration for patterns
 */
export interface PatternRendering {
    color?: string;
    backgroundColor?: string;
    icon?: string;
    template?: string;       // For widget rendering, e.g., "{{label}}"
    className?: string;
    widgetMode?: boolean;    // Whether to render as widget vs inline
}

/**
 * Scope rules for patterns
 */
export interface ScopeRule {
    type: 'include' | 'exclude';
    scope: 'note' | 'folder' | 'vault';
    pattern?: string;        // Glob pattern for matching paths
}

/**
 * Pattern constraints
 */
export interface PatternConstraints {
    allowedEntityKinds?: string[];
    requiredAttributes?: string[];
    scopeRules?: ScopeRule[];
    minLength?: number;
    maxLength?: number;
}

/**
 * The main Pattern Definition
 */
export interface PatternDefinition {
    // Identity
    id: string;
    name: string;
    description?: string;

    // Classification
    kind: RefKind;
    enabled: boolean;
    priority: number;        // Higher = first (for conflict resolution)

    // The regex pattern
    pattern: string;         // Raw regex string
    flags: string;           // 'g', 'gi', 'gm', etc.

    // Capture group mappings
    captures: Record<string, CaptureMapping>;

    // Validation
    validator?: ValidatorFn;

    // Rendering hints
    rendering: PatternRendering;

    // Constraints
    constraints?: PatternConstraints;

    // Metadata
    isBuiltIn: boolean;      // System pattern vs user-defined
    createdAt?: number;
    updatedAt?: number;
}

/**
 * Serializable version of PatternDefinition (for storage)
 * Excludes function types that can't be serialized
 */
export interface SerializablePatternDefinition {
    id: string;
    name: string;
    description?: string;
    kind: RefKind;
    enabled: boolean;
    priority: number;
    pattern: string;
    flags: string;
    captures: Record<string, Omit<CaptureMapping, 'transform'>>;
    rendering: PatternRendering;
    constraints?: PatternConstraints;
    isBuiltIn: boolean;
    createdAt?: number;
    updatedAt?: number;
}

/**
 * Convert PatternDefinition to serializable form
 */
export function toSerializable(pattern: PatternDefinition): SerializablePatternDefinition {
    const captures: Record<string, Omit<CaptureMapping, 'transform'>> = {};

    for (const [key, mapping] of Object.entries(pattern.captures)) {
        captures[key] = {
            group: mapping.group,
            required: mapping.required,
        };
    }

    return {
        id: pattern.id,
        name: pattern.name,
        description: pattern.description,
        kind: pattern.kind,
        enabled: pattern.enabled,
        priority: pattern.priority,
        pattern: pattern.pattern,
        flags: pattern.flags,
        captures,
        rendering: pattern.rendering,
        constraints: pattern.constraints,
        isBuiltIn: pattern.isBuiltIn,
        createdAt: pattern.createdAt,
        updatedAt: pattern.updatedAt,
    };
}

/**
 * Validate a regex pattern string
 */
export function validatePatternSyntax(pattern: string, flags: string): { valid: boolean; error?: string } {
    try {
        new RegExp(pattern, flags);
        return { valid: true };
    } catch (e) {
        return { valid: false, error: (e as Error).message };
    }
}
