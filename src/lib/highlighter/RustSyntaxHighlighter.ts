/**
 * RustSyntaxHighlighter - TipTap extension using Rust/WASM for pattern detection
 * 
 * This is the A/B testing version alongside UnifiedSyntaxHighlighter.
 * Uses Rust ImplicitCortex for entity detection, TS only for decorations.
 * 
 * Key features:
 * - Smart alias detection ("Luffy" → "Monkey D. Luffy")
 * - Content-hash based caching (no re-highlight on cursor move)
 * - Sub-10ms highlighting via WASM
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { highlighterBridge, type HighlightSpan } from './HighlighterBridge';
import { ENTITY_COLORS, type EntityKind } from '@/lib/types/entityTypes';

// ==================== OPTIONS ====================

export interface RustSyntaxOptions {
    onImplicitClick?: (entityId: string, entityLabel: string) => void;
    onTemporalClick?: (temporal: string) => void;
    currentNoteId?: string | (() => string | undefined);
    logPerformance?: boolean;
}

// ==================== HELPERS ====================

const rustPluginKey = new PluginKey('rust-syntax-highlighter');

function resolveNoteId(noteId: string | (() => string | undefined) | undefined): string {
    if (typeof noteId === 'function') {
        return noteId() || 'unknown';
    }
    return noteId || 'unknown';
}

/**
 * Extract full text from ProseMirror document
 */
function extractDocText(doc: ProseMirrorNode): string {
    let text = '';
    doc.descendants((node) => {
        if (node.isText && node.text) {
            text += node.text;
        } else if (node.isBlock) {
            text += '\n';
        }
    });
    return text;
}

/**
 * Convert HighlightSpans to ProseMirror Decorations
 */
function spansToDecorations(
    spans: HighlightSpan[],
    doc: ProseMirrorNode,
    options: RustSyntaxOptions
): Decoration[] {
    const decorations: Decoration[] = [];

    // Build position map: character offset → document position
    // This is needed because Rust returns character offsets but ProseMirror uses doc positions
    const positionMap: number[] = [];
    let charOffset = 0;

    doc.descendants((node, pos) => {
        if (node.isText && node.text) {
            for (let i = 0; i < node.text.length; i++) {
                positionMap[charOffset + i] = pos + i;
            }
            charOffset += node.text.length;
        } else if (node.isBlock) {
            positionMap[charOffset] = pos;
            charOffset += 1;
        }
    });

    for (const span of spans) {
        const from = positionMap[span.start];
        const to = positionMap[span.end - 1] !== undefined
            ? positionMap[span.end - 1] + 1
            : positionMap[span.start] + (span.end - span.start);

        if (from === undefined || to === undefined) continue;

        // Determine styling based on span kind
        let style = '';
        let className = '';
        let dataAttrs: Record<string, string> = {};

        switch (span.kind) {
            case 'implicit': {
                const entityKind = span.metadata.entityKind || 'CHARACTER';
                const varName = `--entity-${entityKind.toLowerCase().replace('_', '-')}`;
                const color = `hsl(var(${varName}))`;
                const bgColor = `hsl(var(${varName}) / 0.1)`;

                style = `
          background-color: ${bgColor}; 
          color: ${color}; 
          padding: 0px 2px; 
          border-bottom: 2px ${span.confidence < 1.0 ? 'dotted' : 'solid'} ${color}; 
          cursor: help;
        `;
                className = 'rust-implicit-highlight';
                dataAttrs = {
                    'data-entity-id': span.metadata.entityId || '',
                    'data-entity-kind': entityKind,
                    'data-entity-label': span.label,
                    'data-confidence': span.confidence.toString(),
                    'title': `${entityKind}: ${span.label}${span.metadata.isAlias ? ' (alias)' : ''}`,
                };
                break;
            }

            case 'temporal': {
                style = `
          background-color: hsl(var(--warning) / 0.15);
          color: hsl(var(--warning));
          padding: 0px 2px;
          border-bottom: 2px dashed hsl(var(--warning));
          cursor: pointer;
        `;
                className = 'rust-temporal-highlight';
                dataAttrs = {
                    'data-temporal': span.content,
                    'data-temporal-kind': span.target,
                    'title': `Temporal: ${span.content}`,
                };
                break;
            }
        }

        decorations.push(
            Decoration.inline(from, to, {
                class: className,
                style,
                ...dataAttrs,
            }, { inclusiveStart: false, inclusiveEnd: false })
        );
    }

    return decorations;
}

// ==================== EXTENSION ====================

export const RustSyntaxHighlighter = Extension.create<RustSyntaxOptions>({
    name: 'rustSyntaxHighlighter',

    addOptions() {
        return {
            onImplicitClick: undefined,
            onTemporalClick: undefined,
            currentNoteId: undefined,
            logPerformance: false,
        };
    },

    addProseMirrorPlugins() {
        const options = this.options;
        let lastDocText = '';

        return [
            new Plugin({
                key: rustPluginKey,
                state: {
                    init(_, { doc }) {
                        // Initial render - may not have Rust ready yet
                        if (!highlighterBridge.isReady()) {
                            return DecorationSet.empty;
                        }

                        const text = extractDocText(doc);
                        const noteId = resolveNoteId(options.currentNoteId);
                        const result = highlighterBridge.highlight(text, noteId);

                        if (options.logPerformance) {
                            console.log(`[RustHighlighter] Initial: ${result.scanTimeMs.toFixed(1)}ms, ${result.spans.length} spans`);
                        }

                        lastDocText = text;
                        const decorations = spansToDecorations(result.spans, doc, options);
                        return DecorationSet.create(doc, decorations);
                    },

                    apply(tr, oldDecorations, oldState, newState) {
                        // CRITICAL: Only re-highlight on content change, not cursor movement
                        if (!tr.docChanged) {
                            return oldDecorations.map(tr.mapping, tr.doc);
                        }

                        if (!highlighterBridge.isReady()) {
                            return DecorationSet.empty;
                        }

                        const text = extractDocText(newState.doc);

                        // Skip if text hasn't changed (can happen with non-text changes)
                        if (text === lastDocText) {
                            return oldDecorations.map(tr.mapping, tr.doc);
                        }

                        lastDocText = text;
                        const noteId = resolveNoteId(options.currentNoteId);
                        const result = highlighterBridge.highlight(text, noteId);

                        if (options.logPerformance && !result.wasCached) {
                            console.log(`[RustHighlighter] Scan: ${result.scanTimeMs.toFixed(1)}ms, ${result.spans.length} spans`);
                        }

                        const decorations = spansToDecorations(result.spans, newState.doc, options);
                        return DecorationSet.create(newState.doc, decorations);
                    },
                },

                props: {
                    decorations(state) {
                        return rustPluginKey.getState(state);
                    },

                    handleDOMEvents: {
                        click: (view, event) => {
                            const target = event.target as HTMLElement;

                            // Handle implicit entity clicks
                            const entityId = target.getAttribute('data-entity-id');
                            if (entityId && options.onImplicitClick) {
                                const entityLabel = target.getAttribute('data-entity-label') || '';
                                event.preventDefault();
                                event.stopPropagation();
                                options.onImplicitClick(entityId, entityLabel);
                                return true;
                            }

                            // Handle temporal clicks
                            const temporal = target.getAttribute('data-temporal');
                            if (temporal && options.onTemporalClick) {
                                event.preventDefault();
                                event.stopPropagation();
                                options.onTemporalClick(temporal);
                                return true;
                            }

                            return false;
                        },
                    },
                },
            }),
        ];
    },
});
