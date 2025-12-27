/**
 * Shared types for Scanner V3
 */
import type { RefKind } from '@/lib/refs';

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

export interface ScannerConfig {
    debounceMs: number;         // Default: 500ms
    enableNLP: boolean;         // WinkNLP enrichment
    enableNeuroBERT: boolean;   // Transformers.js enrichment
    enableTriples: boolean;     // Triple extraction
    enableImplicitMatching: boolean; // Phase 5: plain-text entity detection
    enableRelationshipInference: boolean; // Phase 7C: linguistic relationship extraction
    relationshipConfidenceThreshold: number; // Minimum confidence to persist
    batchSize: number;          // CoZo batch insert size
}
