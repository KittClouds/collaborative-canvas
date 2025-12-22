import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EntityKind, ENTITY_KINDS, ENTITY_COLORS } from '../entities/entityTypes';
import type { NEREntity } from '../extraction';
import { entityRegistry } from '../entities/entity-registry';
import { patternRegistry, type PatternDefinition, type RefKind } from '../refs';

export interface UnifiedSyntaxOptions {
  onWikilinkClick?: (title: string) => void;
  checkWikilinkExists?: (title: string) => boolean;
  onTemporalClick?: (temporal: string) => void;
  onBacklinkClick?: (title: string) => void;
  onRefClick?: (kind: RefKind, target: string, payload?: any) => void;
  nerEntities?: NEREntity[] | (() => NEREntity[]);
  onNEREntityClick?: (entity: NEREntity) => void;
  useWidgetMode?: boolean;
}

const syntaxPluginKey = new PluginKey('unified-syntax-highlighter');

// Track which ranges are currently being edited
interface EditingRange {
  from: number;
  to: number;
}

/**
 * Check if cursor/selection overlaps with a range
 */
function isEditing(selection: { from: number; to: number }, range: EditingRange): boolean {
  // Consider "near" as within 2 characters (allows placing cursor before/after)
  const buffer = 2;
  return (
    (selection.from >= range.from - buffer && selection.from <= range.to + buffer) ||
    (selection.to >= range.from - buffer && selection.to <= range.to + buffer) ||
    (selection.from <= range.from && selection.to >= range.to)
  );
}

/**
 * Create a widget for any pattern match
 */
function createPatternWidget(
  label: string,
  kind: RefKind,
  fullMatch: string,
  color: string,
  backgroundColor: string,
  extraClasses: string = '',
  extraStyles: string = ''
): HTMLElement {
  const span = document.createElement('span');
  span.className = `ref-widget ref-${kind} ${extraClasses}`;
  span.textContent = label;

  // Base style + overrides
  span.style.cssText = `
    background-color: ${backgroundColor};
    color: ${color};
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
    font-size: 0.875em;
    cursor: text;
    display: inline-block;
    position: relative;
    ${extraStyles}
  `;

  // Data attributes for identifying the widget
  span.setAttribute('data-ref-kind', kind);
  span.setAttribute('data-ref-label', label);
  span.setAttribute('data-ref-full', fullMatch);

  // Make widget "clickable" to enable editing
  span.setAttribute('contenteditable', 'false');
  span.setAttribute('data-editable-widget', 'true');

  return span;
}

/**
 * Build decorations using PatternRegistry
 */
function buildAllDecorations(
  doc: ProseMirrorNode,
  options: UnifiedSyntaxOptions,
  selection?: { from: number; to: number }
): DecorationSet {
  const decorations: Decoration[] = [];
  const useWidgets = options.useWidgetMode ?? false;

  // Get active patterns sorted by priority
  const patterns = patternRegistry.getActivePatterns();

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    const text = node.text;
    const processed = new Set<number>();

    // 1. Iterate through registered patterns
    for (const pattern of patterns) {
      if (!pattern.enabled) continue;

      const regex = patternRegistry.getCompiledPattern(pattern.id);
      let match: RegExpExecArray | null;

      // Reset regex state
      regex.lastIndex = 0;

      while ((match = regex.exec(text)) !== null) {
        // Safe check for infinite loops with zero-length matches
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }

        const fullMatch = match[0];
        const from = pos + match.index;
        const to = from + fullMatch.length;

        // Check for overlaps with already processed ranges
        let hasOverlap = false;
        for (let i = match.index; i < match.index + fullMatch.length; i++) {
          if (processed.has(i)) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) continue;

        // Mark range as processed
        for (let i = match.index; i < match.index + fullMatch.length; i++) {
          processed.add(i);
        }

        // Logic for "is being edited"
        const isCurrentlyEditing = selection
          ? isEditing(selection, { from, to })
          : false;

        // Extract Label/Target for display
        // Use capture mappings if available, otherwise fallback
        let label = fullMatch;
        let target = fullMatch;

        if (pattern.captures) {
          // Find capture keys that might represent label/display/target
          // This is a heuristic based on common capture names
          const labelKeys = ['label', 'displayText', 'displayName', 'username', 'tagName', 'word'];
          const targetKeys = ['target', 'id', 'username', 'tagName'];

          // Helper to find capture value
          const getCapture = (keys: string[]) => {
            for (const key of keys) {
              if (pattern.captures[key]) {
                const groupIndex = pattern.captures[key].group;
                if (match![groupIndex]) return match![groupIndex];
              }
            }
            return null;
          };

          label = getCapture(labelKeys) || fullMatch;
          target = getCapture(targetKeys) || label;
        }

        // Dynamic State (Existence check for wikilinks)
        let exists = true;
        if (pattern.kind === 'wikilink' && options.checkWikilinkExists) {
          exists = options.checkWikilinkExists(target);
        }

        // Determine Colors
        let color = pattern.rendering?.color || 'hsl(var(--primary))';
        let bgColor = pattern.rendering?.backgroundColor || 'hsl(var(--primary) / 0.15)';

        // Entity Kind Colors
        if (pattern.kind === 'entity') {
          // Try to extract kind from regex if possible, or use generic
          // Default entity pattern has Kind in group 1
          if (match[1] && ENTITY_COLORS[match[1] as EntityKind]) {
            color = ENTITY_COLORS[match[1] as EntityKind];
            bgColor = `${color}20`;
          }
        }

        // Wikilink Colors (Dynamic)
        if (pattern.kind === 'wikilink') {
          color = exists ? 'hsl(var(--primary))' : 'hsl(var(--destructive))';
          bgColor = exists ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--destructive) / 0.15)';
        }

        // Render Widget vs Inline
        const shouldRenderWidget = (useWidgets || pattern.rendering?.widgetMode) && !isCurrentlyEditing;

        if (shouldRenderWidget) {
          // WIDGET
          const widget = createPatternWidget(
            label,
            pattern.kind,
            fullMatch,
            color,
            bgColor,
            pattern.kind === 'wikilink' ? (exists ? 'wikilink-exists' : 'wikilink-broken') : ''
          );

          decorations.push(
            Decoration.widget(from, widget, {
              side: -1,
              key: `${pattern.id}-${from}-${fullMatch}`,
            })
          );

          // Hide original text
          decorations.push(
            Decoration.inline(from, to, {
              class: 'ref-hidden',
              style: 'display: none;',
            })
          );
        } else {
          // INLINE
          let style = `
            background-color: ${bgColor}; 
            color: ${color}; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-weight: 500; 
            font-size: 0.875em; 
            cursor: pointer;
          `;

          // Special inline styles
          if (pattern.kind === 'wikilink') {
            style += ` text-decoration: underline; text-decoration-style: ${exists ? 'dotted' : 'dashed'};`;
          }

          decorations.push(
            Decoration.inline(from, to, {
              class: `ref-highlight ref-${pattern.kind} ${pattern.kind === 'wikilink' ? (exists ? 'wikilink-editing' : 'wikilink-broken wikilink-editing') : ''}`,
              style,
              'data-ref-kind': pattern.kind,
              'data-ref-target': target,
              'data-ref-exists': exists.toString(),
            }, { inclusiveStart: false, inclusiveEnd: false })
          );
        }
      }
    }

    // 2. NER-detected entities (Keep existing logic)
    const nerEntities = typeof options.nerEntities === 'function'
      ? options.nerEntities()
      : options.nerEntities || [];

    if (nerEntities.length > 0) {
      for (const entity of nerEntities) {
        const entityStart = entity.start;
        const entityEnd = entity.end;
        const nodeStart = pos;
        const nodeEnd = pos + text.length;

        if (entityEnd <= nodeStart || entityStart >= nodeEnd) continue;

        const relativeStart = Math.max(0, entityStart - nodeStart);
        const relativeEnd = Math.min(text.length, entityEnd - nodeStart);
        const from = pos + relativeStart;
        const to = pos + relativeEnd;

        // Check overlap
        let hasOverlap = false;
        for (let i = relativeStart; i < relativeEnd; i++) {
          if (processed.has(i)) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) continue;

        // Mark processed
        for (let i = relativeStart; i < relativeEnd; i++) {
          processed.add(i);
        }

        decorations.push(
          Decoration.inline(from, to, {
            class: 'ner-suggestion',
            style: 'background-color: #fbbf2415; border-bottom: 2px dashed #fbbf24; padding: 0px 2px; cursor: pointer;',
            'data-ner-entity': entity.word,
            'data-ner-type': entity.entity_type,
            'data-ner-start': entity.start.toString(),
            'data-ner-end': entity.end.toString(),
          }, { inclusiveStart: false, inclusiveEnd: false })
        );
      }
    }

    // 3. Registered Implicit Entities (Keep existing logic)
    const allRegistered = entityRegistry.getAllEntities();
    if (allRegistered.length > 0) {
      for (const entity of allRegistered) {
        const patterns = [entity.label, ...(entity.aliases || [])];
        for (const pattern of patterns) {
          const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
          let match;
          while ((match = regex.exec(text)) !== null) {
            const from = pos + match.index;
            const to = from + match[0].length;

            // Check overlap
            let hasOverlap = false;
            for (let i = match.index; i < match.index + match[0].length; i++) {
              if (processed.has(i)) {
                hasOverlap = true;
                break;
              }
            }
            if (hasOverlap) continue;

            // Mark processed
            for (let i = match.index; i < match.index + match[0].length; i++) {
              processed.add(i);
            }

            const color = ENTITY_COLORS[entity.kind] || '#6b7280';
            decorations.push(
              Decoration.inline(from, to, {
                class: 'entity-implicit-highlight',
                style: `background-color: ${color}10; color: ${color}; padding: 0px 2px; border-bottom: 2px dotted ${color}; cursor: help;`,
                'data-entity-id': entity.id,
                'data-entity-kind': entity.kind,
                'data-entity-label': entity.label,
                'title': `${entity.kind}: ${entity.label}`
              }, { inclusiveStart: false, inclusiveEnd: false })
            );
          }
        }
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const UnifiedSyntaxHighlighter = Extension.create<UnifiedSyntaxOptions>({
  name: 'unifiedSyntaxHighlighter',

  addOptions() {
    return {
      onWikilinkClick: undefined,
      checkWikilinkExists: undefined,
      onTemporalClick: undefined,
      onBacklinkClick: undefined,
      onRefClick: undefined, // Universal handler
      nerEntities: undefined,
      onNEREntityClick: undefined,
      useWidgetMode: false,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: syntaxPluginKey,
        state: {
          init(_, { doc }) {
            return buildAllDecorations(doc, options);
          },
          apply(tr, oldDecorations, oldState, newState) {
            const useWidgets = options.useWidgetMode ?? false;
            // Rebuild on doc change
            if (tr.docChanged) {
              const selection = { from: newState.selection.from, to: newState.selection.to };
              return buildAllDecorations(newState.doc, options, selection);
            }
            // Check selection change for widget mode editing
            if (tr.selectionSet && useWidgets) {
              const newSelection = { from: newState.selection.from, to: newState.selection.to };
              return buildAllDecorations(newState.doc, options, newSelection);
            }
            return oldDecorations.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return syntaxPluginKey.getState(state);
          },

          handleDOMEvents: {
            // Handle clicks on widgets to enable editing
            mousedown: (view, event) => {
              const target = event.target as HTMLElement;
              if (target.getAttribute('data-editable-widget') === 'true') {
                const pos = view.posAtDOM(target, 0);
                const tr = view.state.tr.setSelection(
                  Selection.near(view.state.doc.resolve(pos))
                );
                view.dispatch(tr);
                return true;
              }
              return false;
            },

            click: (view, event) => {
              const target = event.target as HTMLElement;

              // 1. NER Logic (First, because it's distinct)
              const nerEntity = target.getAttribute('data-ner-entity');
              if (nerEntity && options.onNEREntityClick) {
                event.preventDefault();
                event.stopPropagation();
                const nerType = target.getAttribute('data-ner-type') || '';
                const nerStart = parseInt(target.getAttribute('data-ner-start') || '0', 10);
                const nerEnd = parseInt(target.getAttribute('data-ner-end') || '0', 10);
                options.onNEREntityClick({
                  word: nerEntity,
                  entity_type: nerType,
                  start: nerStart,
                  end: nerEnd,
                  score: 0,
                });
                return true;
              }

              // 2. Universal Ref Logic (from pattern registry)
              // Only trigger if NOT editing (check for editing class, e.g. .ref-hidden is for widget)
              // If we are in inline mode, we check specific classes.
              // Actually, simpler: if it has data-ref-kind, and we are not in edit mode (cursor nearby).

              const refKind = target.getAttribute('data-ref-kind') as RefKind | null;
              const refTarget = target.getAttribute('data-ref-target');

              if (refKind && refTarget) {
                // Prevent click if we are editing this exact element
                // But click handler fires usually when NOT editing.
                event.preventDefault();
                event.stopPropagation();

                // Route to specific handlers for backward compatibility
                if (refKind === 'wikilink' && options.onWikilinkClick) {
                  options.onWikilinkClick(refTarget);
                } else if (refKind === 'backlink' && options.onBacklinkClick) {
                  options.onBacklinkClick(refTarget);
                } else if (refKind === 'temporal' && options.onTemporalClick) {
                  options.onTemporalClick(refTarget);
                } else if (options.onRefClick) {
                  options.onRefClick(refKind, refTarget);
                }
                return true;
              }

              // Fallback for legacy data attributes (just in case)
              const wikilinkTitle = target.getAttribute('data-wikilink-title');
              if (wikilinkTitle && options.onWikilinkClick) {
                event.preventDefault();
                options.onWikilinkClick(wikilinkTitle);
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
