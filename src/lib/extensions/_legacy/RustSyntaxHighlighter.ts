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
import { getOrBuildPositionMap } from './positionMapCache'; // M3: Shared cache
import { ENTITY_COLORS, type EntityKind } from '@/lib/types/entityTypes';
import type { HighlightMode } from '@/atoms/highlightingAtoms';

// ==================== OPTIONS ====================

export interface RustSyntaxOptions {
    onImplicitClick?: (entityId: string, entityLabel: string) => void;
    onTemporalClick?: (temporal: string) => void;
    currentNoteId?: string | (() => string | undefined);
    logPerformance?: boolean;
    /** Highlighting mode - getter for reactive updates */
    getHighlightMode?: () => HighlightMode;
    /** Entity kinds to show in Focus mode - getter for reactive updates */
    getFocusEntityKinds?: () => EntityKind[];
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
 * Convert HighlightSpans to ProseMirror Decorations
 * Mode-aware: respects highlightMode setting
 */
function spansToDecorations(
    spans: HighlightSpan[],
    positionMap: number[],
    options: RustSyntaxOptions
): Decoration[] {
    const decorations: Decoration[] = [];
    // Call getters for reactive settings (if not provided, default to clean mode)
    const mode = options.getHighlightMode?.() ?? 'clean';
    const focusKinds = options.getFocusEntityKinds?.() ?? [];

    // Off mode: no decorations
    if (mode === 'off') {
        return decorations;
    }

    for (const span of spans) {
        const from = positionMap[span.start];
        const to = positionMap[span.end - 1] !== undefined
            ? positionMap[span.end - 1] + 1
            : positionMap[span.start] + (span.end - span.start);

        if (from === undefined || to === undefined) continue;

        // Focus mode: only show selected entity kinds
        if (mode === 'focus') {
            const entityKind = span.metadata?.entityKind as EntityKind | undefined;
            if (!entityKind || (focusKinds.length > 0 && !focusKinds.includes(entityKind))) {
                continue;
            }
        }

        // Determine styling based on span kind and mode
        let style = '';
        let className = '';
        let dataAttrs: Record<string, string> = {};

        switch (span.kind) {
            case 'implicit': {
                const entityKind = span.metadata.entityKind || 'CHARACTER';
                const varName = `--entity-${entityKind.toLowerCase().replace('_', '-')}`;
                const color = `hsl(var(${varName}))`;
                const bgColor = `hsl(var(${varName}) / 0.1)`;

                // Vivid mode: full solid styling always visible
                // Clean mode: subtle dotted underline (current default)
                const isVivid = mode === 'vivid';
                const borderStyle = isVivid ? 'solid' : (span.confidence < 1.0 ? 'dotted' : 'solid');
                const bgOpacity = isVivid ? 0.15 : 0.1;

                style = `
          background-color: hsl(var(${varName}) / ${bgOpacity}); 
          color: ${color}; 
          padding: 0px 2px; 
          border-bottom: 2px ${borderStyle} ${color}; 
          cursor: help;
        `;
                className = isVivid ? 'rust-implicit-highlight vivid' : 'rust-implicit-highlight';
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
                const isVivid = mode === 'vivid';
                style = `
          background-color: hsl(var(--warning) / ${isVivid ? 0.2 : 0.15});
          color: hsl(var(--warning));
          padding: 0px 2px;
          border-bottom: 2px ${isVivid ? 'solid' : 'dashed'} hsl(var(--warning));
          cursor: pointer;
        `;
                className = isVivid ? 'rust-temporal-highlight vivid' : 'rust-temporal-highlight';
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

                        const { text, positionMap } = getOrBuildPositionMap(doc);
                        const noteId = resolveNoteId(options.currentNoteId);
                        const result = highlighterBridge.highlight(text, noteId);

                        if (options.logPerformance) {
                            console.log(`[RustHighlighter] Initial: ${result.scanTimeMs.toFixed(1)}ms, ${result.spans.length} spans`);
                        }

                        lastDocText = text;
                        const decorations = spansToDecorations(result.spans, positionMap, options);
                        return DecorationSet.create(doc, decorations);
                    },

                    apply(tr, oldDecorations, oldState, newState) {
                        // Check for forced rescan (e.g., after entity hydration)
                        const forceRescan = tr.getMeta('entityHydration') || tr.getMeta('forceRescan');

                        // CRITICAL: Only re-highlight on content change OR forced rescan
                        if (!tr.docChanged && !forceRescan) {
                            return oldDecorations.map(tr.mapping, tr.doc);
                        }

                        if (!highlighterBridge.isReady()) {
                            return DecorationSet.empty;
                        }

                        const { text, positionMap } = getOrBuildPositionMap(newState.doc);

                        // Skip if text hasn't changed AND this isn't a forced rescan
                        if (text === lastDocText && !forceRescan) {
                            return oldDecorations.map(tr.mapping, tr.doc);
                        }

                        lastDocText = text;

                        // Invalidate cache on forced rescan to get fresh entity matches
                        if (forceRescan) {
                            const noteId = resolveNoteId(options.currentNoteId);
                            highlighterBridge.invalidateCache(noteId);
                        }

                        const noteId = resolveNoteId(options.currentNoteId);
                        const result = highlighterBridge.highlight(text, noteId);

                        if (options.logPerformance && !result.wasCached) {
                            console.log(`[RustHighlighter] Scan: ${result.scanTimeMs.toFixed(1)}ms, ${result.spans.length} spans`);
                        }

                        const decorations = spansToDecorations(result.spans, positionMap, options);
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
