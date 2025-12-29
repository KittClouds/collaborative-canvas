/**
 * Shared types for Scanner V3
 */
import type { RefKind } from '@/lib/refs';
import type { RegisteredEntity } from '@/lib/cozo/graph/adapters/EntityRegistryAdapter';

/**
 * Cache for a single scan cycle - avoids redundant getAllEntities() calls
 */
export interface ScanCycleCache {
    entities: RegisteredEntity[];
    entityLabelIndex: Map<string, RegisteredEntity>;
}

/**
 * Match event emitted by UnifiedSyntaxHighlighter
 */
export interface PatternMatchEvent {
    kind: RefKind;              // 'entity', 'triple', 'wikilink', etc.
    fullMatch: string;          // Complete matched text
    position: number;           // Start position in document
    length: number;             // Match length
    captures: Record<string, string>; // Captured groups
    patternId: string;          // Pattern that matched
    noteId: string;             // Which note
    timestamp: number;          // When matched
    context?: string;           // Surrounding text (e.g. paragraph)
}

/**
 * AllProfanity matcher configuration
 */
export interface AllProfanityMatcherConfig {
    enableCaching: boolean;     // LRU cache for repeated scans (default: true)
    cacheSize: number;          // Max cache entries (default: 1000)
    enableLeetSpeak: boolean;   // Detect obfuscated mentions like Fr0d0 (default: true)
}

export interface ScannerConfig {
    debounceMs: number;         // Default: 500ms
    enableNLP: boolean;         // WinkNLP enrichment
    enableNeuroBERT: boolean;   // Transformers.js enrichment
    enableTriples: boolean;     // Triple extraction
    enableImplicitMatching: boolean; // Phase 5: plain-text entity detection
    enableRelationshipInference: boolean; // Phase 7C: linguistic relationship extraction
    enableTemporalExtraction: boolean; // Temporal pattern detection via Aho-Corasick
    relationshipConfidenceThreshold: number; // Minimum confidence to persist
    batchSize: number;          // CoZo batch insert size
    useAhoCorasickExtractor: boolean; // Use O(n) Aho-Corasick extractor vs regex
    useAllProfanityMatcher: boolean; // Scanner 3.5: AllProfanity for implicit matching
    allProfanityConfig?: AllProfanityMatcherConfig; // AllProfanity options
    useRelationshipWorker: boolean; // Scanner 3.5: Web Worker for relationship extraction
}

