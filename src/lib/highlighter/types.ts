/**
 * Highlighter Types
 * Shared types for the Rust-powered syntax highlighter
 */

export type SpanKind =
    | 'wikilink'
    | 'backlink'
    | 'entity'
    | 'triple'
    | 'inline_relation'
    | 'tag'
    | 'mention'
    | 'implicit'
    | 'temporal';

export interface HighlightSpan {
    kind: SpanKind;
    start: number;
    end: number;
    content: string;
    label: string;
    target: string;
    confidence: number;
    metadata: SpanMetadata;
}

export interface SpanMetadata {
    entityKind?: string;
    entityId?: string;
    exists?: boolean;
    isAlias?: boolean;
    captures?: Record<string, string>;
}

export interface HighlightResult {
    spans: HighlightSpan[];
    contentHash: string;
    textLength: number;
    wasCached: boolean;
    scanTimeMs: number;
}
