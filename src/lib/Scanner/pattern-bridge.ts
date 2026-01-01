/**
 * ScannerPatternBridge
 * 
 * Bridges Blueprint Hub patterns to the KittCore WASM scanner.
 * Loads patterns from localStorage and CozoDB, converts them to
 * scanner format, and hydrates the scanner on initialization.
 * 
 * @module scanner/pattern-bridge
 */

import type { RelationshipPattern } from '@/features/blueprint-hub/types';
import type { PatternDefinition } from '@/lib/refs/patterns/schema';
import { patternRegistry } from '@/lib/refs/patterns/registry';
import type { RelationPatternInput } from './workers/ScannerWorker';

// ============================================================================
// Types
// ============================================================================

/**
 * Pattern types that can be loaded into the scanner
 */
export type PatternKind = 'syntax' | 'relation' | 'entity' | 'temporal';

/**
 * Unified scanner pattern format
 */
export interface ScannerPattern {
    id: string;
    kind: PatternKind;
    pattern: string;
    metadata: Record<string, unknown>;
    enabled: boolean;
    priority: number;
    source: 'default' | 'blueprint' | 'custom';
}

/**
 * Result from loading patterns
 */
export interface PatternLoadResult {
    syntaxPatterns: PatternDefinition[];
    relationPatterns: RelationPatternInput[];
    stats: {
        syntaxCount: number;
        relationCount: number;
        loadTimeMs: number;
    };
}

// ============================================================================
// Constants
// ============================================================================

const RELATIONSHIP_PATTERNS_KEY = 'blueprint_relationship_patterns';

// ============================================================================
// Pattern Loading Functions
// ============================================================================

/**
 * Load relationship patterns from localStorage (Blueprint Hub storage)
 */
function loadRelationshipPatternsFromStorage(): RelationshipPattern[] {
    try {
        const stored = localStorage.getItem(RELATIONSHIP_PATTERNS_KEY);
        if (!stored) return [];

        const patterns = JSON.parse(stored) as RelationshipPattern[];
        return patterns.filter(p => p.enabled);
    } catch (error) {
        console.warn('[ScannerPatternBridge] Failed to load relationship patterns:', error);
        return [];
    }
}

/**
 * Convert Blueprint Hub RelationshipPattern to scanner format
 */
function convertRelationPatternToScanner(pattern: RelationshipPattern): RelationPatternInput {
    // Blueprint Hub stores verb patterns as regex, e.g., "met|knows|knew|befriended"
    // Scanner expects array of pattern strings
    const patterns = pattern.verb_pattern.split('|').map(p => p.trim());

    return {
        relation_type: pattern.relationship_type,
        patterns,
        confidence: pattern.confidence,
        bidirectional: pattern.bidirectional,
    };
}

/**
 * Get active syntax patterns from PatternRegistry
 */
function getSyntaxPatterns(): PatternDefinition[] {
    return patternRegistry.getActivePatterns();
}

// ============================================================================
// Main Bridge Class
// ============================================================================

/**
 * ScannerPatternBridge - Loads and converts patterns for scanner hydration
 */
export class ScannerPatternBridge {
    private cachedRelationPatterns: RelationPatternInput[] | null = null;
    private cachedSyntaxPatterns: PatternDefinition[] | null = null;
    private lastLoadTime: number = 0;
    private readonly cacheTimeoutMs = 5000; // 5 second cache

    /**
     * Load all patterns from storage and registries
     */
    async loadPatterns(): Promise<PatternLoadResult> {
        const start = performance.now();

        // Load syntax patterns from PatternRegistry
        const syntaxPatterns = getSyntaxPatterns();

        // Load relationship patterns from Blueprint Hub storage
        const blueprintPatterns = loadRelationshipPatternsFromStorage();
        const relationPatterns = blueprintPatterns.map(convertRelationPatternToScanner);

        // Cache results
        this.cachedSyntaxPatterns = syntaxPatterns;
        this.cachedRelationPatterns = relationPatterns;
        this.lastLoadTime = Date.now();

        const loadTimeMs = performance.now() - start;

        return {
            syntaxPatterns,
            relationPatterns,
            stats: {
                syntaxCount: syntaxPatterns.length,
                relationCount: relationPatterns.length,
                loadTimeMs,
            },
        };
    }

    /**
     * Get relation patterns for scanner hydration
     * Uses cache if available and not stale
     */
    getRelationPatterns(): RelationPatternInput[] {
        if (this.cachedRelationPatterns && !this.isCacheStale()) {
            return this.cachedRelationPatterns;
        }

        const blueprintPatterns = loadRelationshipPatternsFromStorage();
        this.cachedRelationPatterns = blueprintPatterns.map(convertRelationPatternToScanner);
        this.lastLoadTime = Date.now();

        return this.cachedRelationPatterns;
    }

    /**
     * Get syntax patterns for scanner hydration
     */
    getSyntaxPatterns(): PatternDefinition[] {
        if (this.cachedSyntaxPatterns && !this.isCacheStale()) {
            return this.cachedSyntaxPatterns;
        }

        this.cachedSyntaxPatterns = getSyntaxPatterns();
        this.lastLoadTime = Date.now();

        return this.cachedSyntaxPatterns;
    }

    /**
     * Invalidate cache (call when patterns are updated in Blueprint Hub)
     */
    invalidateCache(): void {
        this.cachedRelationPatterns = null;
        this.cachedSyntaxPatterns = null;
        this.lastLoadTime = 0;
    }

    /**
     * Check if cache is stale
     */
    private isCacheStale(): boolean {
        return Date.now() - this.lastLoadTime > this.cacheTimeoutMs;
    }

    /**
     * Get pattern statistics
     */
    getStats(): { syntax: number; relations: number; cached: boolean; lastLoad: number } {
        return {
            syntax: this.cachedSyntaxPatterns?.length ?? 0,
            relations: this.cachedRelationPatterns?.length ?? 0,
            cached: !this.isCacheStale(),
            lastLoad: this.lastLoadTime,
        };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const scannerPatternBridge = new ScannerPatternBridge();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Load relation patterns directly (for use in scanner worker)
 */
export function loadRelationPatternsForScanner(): RelationPatternInput[] {
    return scannerPatternBridge.getRelationPatterns();
}

/**
 * Refresh patterns from storage (call after Blueprint Hub updates)
 */
export function refreshScannerPatterns(): void {
    scannerPatternBridge.invalidateCache();
}
