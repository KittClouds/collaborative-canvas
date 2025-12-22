/**
 * Pattern Registry
 * 
 * Manages active patterns for the Ref parsing system.
 * Handles registration, caching, and retrieval of patterns.
 */

import type { PatternDefinition, SerializablePatternDefinition } from './schema';
import { validatePatternSyntax, toSerializable } from './schema';
import { DEFAULT_PATTERNS } from './defaults';

/**
 * Pattern Registry Class
 */
export class PatternRegistry {
    private patterns: Map<string, PatternDefinition> = new Map();
    private compiledCache: Map<string, RegExp> = new Map();
    private sortedPatternsCache: PatternDefinition[] | null = null;

    constructor() {
        // Load defaults on construction
        this.loadDefaults();
    }

    /**
     * Load default built-in patterns
     */
    loadDefaults(): void {
        for (const pattern of DEFAULT_PATTERNS) {
            this.patterns.set(pattern.id, { ...pattern });
        }
        this.invalidateSortedCache();
    }

    /**
     * Register a new pattern
     */
    register(pattern: PatternDefinition): void {
        // Validate regex syntax
        const validation = validatePatternSyntax(pattern.pattern, pattern.flags);
        if (!validation.valid) {
            throw new Error(`Invalid regex pattern: ${validation.error}`);
        }

        // Set timestamps
        const now = Date.now();
        const existing = this.patterns.get(pattern.id);

        const patternToStore: PatternDefinition = {
            ...pattern,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };

        this.patterns.set(pattern.id, patternToStore);
        this.invalidateCache(pattern.id);
        this.invalidateSortedCache();
    }

    /**
     * Unregister a pattern
     */
    unregister(patternId: string): boolean {
        const deleted = this.patterns.delete(patternId);
        if (deleted) {
            this.invalidateCache(patternId);
            this.invalidateSortedCache();
        }
        return deleted;
    }

    /**
     * Get a pattern by ID
     */
    getPattern(patternId: string): PatternDefinition | undefined {
        return this.patterns.get(patternId);
    }

    /**
     * Get all patterns
     */
    getAllPatterns(): PatternDefinition[] {
        return Array.from(this.patterns.values());
    }

    /**
     * Get all enabled patterns, sorted by priority (descending)
     */
    getActivePatterns(): PatternDefinition[] {
        if (this.sortedPatternsCache === null) {
            this.sortedPatternsCache = Array.from(this.patterns.values())
                .filter(p => p.enabled)
                .sort((a, b) => b.priority - a.priority);
        }
        return this.sortedPatternsCache;
    }

    /**
     * Get compiled regex for a pattern (cached)
     */
    getCompiledPattern(patternId: string): RegExp {
        if (!this.compiledCache.has(patternId)) {
            const def = this.patterns.get(patternId);
            if (!def) {
                throw new Error(`Pattern ${patternId} not found`);
            }
            this.compiledCache.set(patternId, new RegExp(def.pattern, def.flags));
        }
        // Clone the regex to reset lastIndex
        const cached = this.compiledCache.get(patternId)!;
        return new RegExp(cached.source, cached.flags);
    }

    /**
     * Toggle pattern enabled state
     */
    togglePattern(patternId: string, enabled?: boolean): boolean {
        const pattern = this.patterns.get(patternId);
        if (!pattern) return false;

        pattern.enabled = enabled ?? !pattern.enabled;
        pattern.updatedAt = Date.now();
        this.invalidateSortedCache();
        return true;
    }

    /**
     * Update pattern priority
     */
    setPriority(patternId: string, priority: number): boolean {
        const pattern = this.patterns.get(patternId);
        if (!pattern) return false;

        pattern.priority = priority;
        pattern.updatedAt = Date.now();
        this.invalidateSortedCache();
        return true;
    }

    /**
     * Check if registry has any custom (non-builtin) patterns
     */
    hasCustomPatterns(): boolean {
        return Array.from(this.patterns.values()).some(p => !p.isBuiltIn);
    }

    /**
     * Get patterns by kind
     */
    getPatternsByKind(kind: string): PatternDefinition[] {
        return Array.from(this.patterns.values()).filter(p => p.kind === kind);
    }

    /**
     * Export all patterns (for persistence)
     */
    exportPatterns(): SerializablePatternDefinition[] {
        return Array.from(this.patterns.values()).map(toSerializable);
    }

    /**
     * Import patterns (from persistence)
     */
    importPatterns(serialized: SerializablePatternDefinition[], merge = true): void {
        if (!merge) {
            this.patterns.clear();
            this.loadDefaults();
        }

        for (const pattern of serialized) {
            // Skip built-in patterns when merging (they're already loaded)
            if (merge && pattern.isBuiltIn) continue;

            // Convert to full PatternDefinition
            const fullPattern: PatternDefinition = {
                ...pattern,
                captures: Object.fromEntries(
                    Object.entries(pattern.captures).map(([key, val]) => [key, { ...val }])
                ),
            };

            this.register(fullPattern);
        }
    }

    /**
     * Reset to defaults (removes custom patterns)
     */
    reset(): void {
        this.patterns.clear();
        this.compiledCache.clear();
        this.sortedPatternsCache = null;
        this.loadDefaults();
    }

    /**
     * Invalidate compiled cache for a specific pattern
     */
    private invalidateCache(patternId: string): void {
        this.compiledCache.delete(patternId);
    }

    /**
     * Invalidate sorted patterns cache
     */
    private invalidateSortedCache(): void {
        this.sortedPatternsCache = null;
    }
}

// Singleton instance
export const patternRegistry = new PatternRegistry();
