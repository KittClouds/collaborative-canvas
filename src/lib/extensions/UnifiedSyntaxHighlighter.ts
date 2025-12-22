import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EntityKind, ENTITY_KINDS, ENTITY_COLORS } from '../entities/entityTypes';
import type { NEREntity } from '../extraction';
import { entityRegistry } from '../entities/entity-registry';

export interface UnifiedSyntaxOptions {
  onWikilinkClick?: (title: string) => void;
  checkWikilinkExists?: (title: string) => boolean;
  onTemporalClick?: (temporal: string) => void;
  onBacklinkClick?: (title: string) => void;
  nerEntities?: NEREntity[] | (() => NEREntity[]);
  onNEREntityClick?: (entity: NEREntity) => void;
  useWidgetMode?: boolean;
}

const syntaxPluginKey = new PluginKey('unified-syntax-highlighter');

// 🆕 Track which ranges are currently being edited
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
 * Create widget with edit detection
 */
function createEditableWidget(
  label: string,
  kind: string,
  fullMatch: string,
  color: string
): HTMLElement {
  const span = document.createElement('span');
  span.className = 'entity-widget';
  span.textContent = label;
  span.style.cssText = `
    background-color: ${color}20;
    color: ${color};
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
    font-size: 0.875em;
    cursor: text;
    display: inline-block;
    position: relative;
  `;
  span.setAttribute('data-entity-kind', kind);
  span.setAttribute('data-entity-label', label);
  span.setAttribute('data-entity-full', fullMatch);

  // 🆕 Make widget "clickable" to enable editing
  span.setAttribute('contenteditable', 'false');
  span.setAttribute('data-editable-widget', 'true');

  return span;
}

/**
 * Build decorations with smart editing detection
 */
function buildAllDecorations(
  doc: ProseMirrorNode,
  options: UnifiedSyntaxOptions,
  selection?: { from: number; to: number }
): DecorationSet {
  const decorations: Decoration[] = [];
  const useWidgets = options.useWidgetMode ?? false;

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    const text = node.text;
    const processed = new Set<number>();

    // 1. Entity syntax - WITH SMART WIDGET MODE
    const entityRegex = /\[([A-Z_]+(?::[A-Z_]+)?)\|([^\]|]+)(?:\|[^\]]+)?\]/g;
    let match;

    while ((match = entityRegex.exec(text)) !== null) {
      const [fullMatch, kind, label] = match;
      const from = pos + match.index;
      const to = from + fullMatch.length;

      for (let i = match.index; i < match.index + fullMatch.length; i++) {
        processed.add(i);
      }

      const baseKind = kind.split(':')[0] as EntityKind;
      if (ENTITY_KINDS.includes(baseKind)) {
        const color = ENTITY_COLORS[baseKind] || '#6b7280';

        // 🆕 Check if this entity is being edited
        const isCurrentlyEditing = selection
          ? isEditing(selection, { from, to })
          : false;

        if (useWidgets && !isCurrentlyEditing) {
          // WIDGET MODE: Show clean widget (not being edited)
          const widget = createEditableWidget(label, kind, fullMatch, color);
          decorations.push(
            Decoration.widget(from, widget, {
              side: -1, // 🆕 Changed from 0 to -1 (places widget BEFORE position)
              key: `entity-${from}-${fullMatch}`,
            })
          );
          // Hide original text - use a more stable approach that keeps it in the flow
          decorations.push(
            Decoration.inline(from, to, {
              class: 'entity-hidden',
              style: 'display: none;', // Reverting to display: none as it's more stable for block flow than absolute positioning
            })
          );
        } else {
          // INLINE MODE: Show full syntax (being edited OR widget mode off)
          decorations.push(
            Decoration.inline(from, to, {
              class: 'entity-highlight entity-editing',
              style: `background-color: ${color}20; color: ${color}; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em;`,
              'data-kind': kind,
            }, { inclusiveStart: false, inclusiveEnd: false })
          );
        }
      }
    }

    // 2. WikiLinks - SAME PATTERN
    const wikilinkRegex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

    while ((match = wikilinkRegex.exec(text)) !== null) {
      const [fullMatch, title] = match;
      const from = pos + match.index;
      const to = from + fullMatch.length;

      let hasOverlap = false;
      for (let i = match.index; i < match.index + fullMatch.length; i++) {
        if (processed.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;

      for (let i = match.index; i < match.index + fullMatch.length; i++) {
        processed.add(i);
      }

      const titleTrimmed = title.trim();
      const exists = options.checkWikilinkExists?.(titleTrimmed) ?? true;

      const isCurrentlyEditing = selection
        ? isEditing(selection, { from, to })
        : false;

      if (useWidgets && !isCurrentlyEditing) {
        // WIDGET MODE
        const widget = createWikilinkWidget(titleTrimmed, fullMatch, exists);
        decorations.push(
          Decoration.widget(from, widget, {
            side: -1,
            key: `wikilink-${from}-${fullMatch}`,
          })
        );
        decorations.push(
          Decoration.inline(from, to, {
            class: 'wikilink-hidden',
            style: 'display: none;',
          })
        );
      } else {
        // INLINE MODE
        const baseStyle = 'padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; cursor: pointer;';
        const style = exists
          ? `${baseStyle} background-color: hsl(var(--primary) / 0.15); color: hsl(var(--primary)); text-decoration: underline; text-decoration-style: dotted;`
          : `${baseStyle} background-color: hsl(var(--destructive) / 0.15); color: hsl(var(--destructive)); text-decoration: underline; text-decoration-style: dashed;`;

        decorations.push(
          Decoration.inline(from, to, {
            class: exists ? 'wikilink-highlight wikilink-editing' : 'wikilink-highlight wikilink-broken wikilink-editing',
            style,
            'data-wikilink-title': titleTrimmed,
            'data-wikilink-exists': exists ? 'true' : 'false',
          }, { inclusiveStart: false, inclusiveEnd: false })
        );
      }
    }

    // 3. Backlinks - SAME PATTERN
    const backlinkRegex = /<<([^>]+)>>/g;

    while ((match = backlinkRegex.exec(text)) !== null) {
      const [fullMatch, backlinkTitle] = match;
      const from = pos + match.index;
      const to = from + fullMatch.length;

      let hasOverlap = false;
      for (let i = match.index; i < match.index + fullMatch.length; i++) {
        if (processed.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;

      for (let i = match.index; i < match.index + fullMatch.length; i++) {
        processed.add(i);
      }

      const titleTrimmed = backlinkTitle.trim();
      const entityMatch = titleTrimmed.match(/^\[([A-Z_]+)(?::[A-Z_]+)?\|/);
      const entityKind = entityMatch ? entityMatch[1] as EntityKind : null;
      const color = entityKind && ENTITY_COLORS[entityKind]
        ? ENTITY_COLORS[entityKind]
        : 'hsl(var(--primary))';

      const isCurrentlyEditing = selection
        ? isEditing(selection, { from, to })
        : false;

      if (useWidgets && !isCurrentlyEditing) {
        // WIDGET MODE
        const widget = createBacklinkWidget(titleTrimmed, fullMatch, color);
        decorations.push(
          Decoration.widget(from, widget, {
            side: -1,
            key: `backlink-${from}-${fullMatch}`,
          })
        );
        decorations.push(
          Decoration.inline(from, to, {
            class: 'backlink-hidden',
            style: 'display: none;',
          })
        );
      } else {
        // INLINE MODE
        decorations.push(
          Decoration.inline(from, to, {
            class: 'backlink-highlight backlink-editing',
            style: `background-color: ${color}20; color: ${color}; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; cursor: pointer;`,
            'data-backlink-title': titleTrimmed,
          }, { inclusiveStart: false, inclusiveEnd: false })
        );
      }
    }

    // 4. Tags: #hashtag
    const tagRegex = /#(\w+)/g;

    while ((match = tagRegex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;

      let hasOverlap = false;
      for (let i = match.index; i < match.index + match[0].length; i++) {
        if (processed.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;

      for (let i = match.index; i < match.index + match[0].length; i++) {
        processed.add(i);
      }

      decorations.push(
        Decoration.inline(from, to, {
          class: 'tag-highlight',
          style: 'background-color: #3b82f620; color: #3b82f6; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; cursor: pointer;',
          'data-tag': match[1],
        }, { inclusiveStart: false, inclusiveEnd: false })
      );
    }

    // 5. Mentions: @username
    const mentionRegex = /@(\w+)/g;

    while ((match = mentionRegex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;

      let hasOverlap = false;
      for (let i = match.index; i < match.index + match[0].length; i++) {
        if (processed.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;

      for (let i = match.index; i < match.index + match[0].length; i++) {
        processed.add(i);
      }

      decorations.push(
        Decoration.inline(from, to, {
          class: 'mention-highlight',
          style: 'background-color: #8b5cf620; color: #8b5cf6; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; cursor: pointer;',
          'data-mention': match[1],
        }, { inclusiveStart: false, inclusiveEnd: false })
      );
    }

    // 6. Temporal expressions
    const temporalPatterns = [
      /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(second|minute|hour|day|week|month|year)s?\s+(later|before|after|earlier|ago)\b/gi,
      /\b(next|last|the following|the previous)\s+(morning|afternoon|evening|night|day|week|month|year|dawn|dusk|midnight|noon)\b/gi,
      /\b(yesterday|tomorrow|today|tonight|nowadays)\b/gi,
      /\b(at|by|before|after|around)\s+(dawn|dusk|midnight|noon|sunrise|sunset)\b/gi,
      /\b(moments?|seconds?|minutes?|hours?)\s+(later|before|after|earlier)\b/gi,
      /\b(meanwhile|eventually|suddenly|immediately|soon|later|afterwards|beforehand)\b/gi,
      /\b(in the|that)\s+(morning|afternoon|evening|night)\b/gi,
      /\b(the next day|the day after|the night before|the morning of|the evening of)\b/gi,
    ];

    for (const temporalRegex of temporalPatterns) {
      temporalRegex.lastIndex = 0;

      while ((match = temporalRegex.exec(text)) !== null) {
        const from = pos + match.index;
        const to = from + match[0].length;

        let hasOverlap = false;
        for (let i = match.index; i < match.index + match[0].length; i++) {
          if (processed.has(i)) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) continue;

        for (let i = match.index; i < match.index + match[0].length; i++) {
          processed.add(i);
        }

        decorations.push(
          Decoration.inline(from, to, {
            class: 'temporal-highlight',
            style: 'background-color: hsl(var(--chart-4) / 0.15); color: hsl(var(--chart-4)); padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em;',
            'data-temporal': match[0],
          }, { inclusiveStart: false, inclusiveEnd: false })
        );
      }
    }

    // 7. NER-detected entities
    const nerEntities = typeof options.nerEntities === 'function'
      ? options.nerEntities()
      : options.nerEntities || [];

    if (nerEntities.length > 0) {
      for (const entity of nerEntities) {
        // ... (existing NER code)
        const entityStart = entity.start;
        const entityEnd = entity.end;
        const nodeStart = pos;
        const nodeEnd = pos + text.length;

        if (entityEnd <= nodeStart || entityStart >= nodeEnd) continue;

        const relativeStart = Math.max(0, entityStart - nodeStart);
        const relativeEnd = Math.min(text.length, entityEnd - nodeStart);

        const from = pos + relativeStart;
        const to = pos + relativeEnd;

        let hasOverlap = false;
        for (let i = relativeStart; i < relativeEnd; i++) {
          if (processed.has(i)) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) continue;

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

    // 8. Registered Implicit Entities (Phase 1)
    const allRegistered = entityRegistry.getAllEntities();

    // Quick escape if no entities
    if (allRegistered.length > 0) {
      // Sort by length desc to handle overlapping (longest first)
      // Note: This is a simple per-node check. For better perf with huge registries, 
      // we'd use Aho-Corasick or similar. For now ( < 1000 entities), direct regex is fine.

      for (const entity of allRegistered) {
        const patterns = [entity.label, ...(entity.aliases || [])];

        for (const pattern of patterns) {
          // Naive regex matching for implicit mentions
          // Using word boundaries to avoid partial matches
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

// Helper functions (moved outside, reuse for all types)
function createWikilinkWidget(
  title: string,
  fullMatch: string,
  exists: boolean
): HTMLElement {
  const span = document.createElement('span');
  span.className = exists ? 'wikilink-widget wikilink-exists' : 'wikilink-widget wikilink-broken';
  span.textContent = title;

  const baseStyle = 'padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; cursor: text; display: inline-block;';
  const style = exists
    ? `${baseStyle} background-color: hsl(var(--primary) / 0.15); color: hsl(var(--primary)); text-decoration: underline; text-decoration-style: dotted;`
    : `${baseStyle} background-color: hsl(var(--destructive) / 0.15); color: hsl(var(--destructive)); text-decoration: underline; text-decoration-style: dashed;`;

  span.style.cssText = style;
  span.setAttribute('data-wikilink-title', title);
  span.setAttribute('data-wikilink-exists', exists ? 'true' : 'false');
  span.setAttribute('data-wikilink-full', fullMatch);
  span.setAttribute('contenteditable', 'false');
  span.setAttribute('data-editable-widget', 'true');

  return span;
}

function createBacklinkWidget(
  backlinkTitle: string,
  fullMatch: string,
  color: string
): HTMLElement {
  const span = document.createElement('span');
  span.className = 'backlink-widget';

  const entityMatch = backlinkTitle.match(/\[([A-Z_]+)(?::[A-Z_]+)?\|([^\]]+)\]/);
  const displayText = entityMatch ? entityMatch[2] : backlinkTitle;

  span.textContent = displayText;
  span.style.cssText = `
    background-color: ${color}20;
    color: ${color};
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
    font-size: 0.875em;
    cursor: text;
    display: inline-block;
  `;
  span.setAttribute('data-backlink-title', backlinkTitle);
  span.setAttribute('data-backlink-full', fullMatch);
  span.setAttribute('contenteditable', 'false');
  span.setAttribute('data-editable-widget', 'true');

  return span;
}

export const UnifiedSyntaxHighlighter = Extension.create<UnifiedSyntaxOptions>({
  name: 'unifiedSyntaxHighlighter',

  addOptions() {
    return {
      onWikilinkClick: undefined,
      checkWikilinkExists: undefined,
      onTemporalClick: undefined,
      onBacklinkClick: undefined,
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

            // If only selection changed and we are in widget mode, 
            // check if we NEED to rebuild (selection near a syntax element)
            if (tr.selectionSet && useWidgets) {
              const oldSelection = { from: oldState.selection.from, to: oldState.selection.to };
              const newSelection = { from: newState.selection.from, to: newState.selection.to };

              // Simple check: did selection cross a text block?
              // Or better: just rebuild it less aggressively.
              // For now, let's just make sure we don't return oldDecorations if selection changed
              // BUT we can skip if the change is "outside" any widgets.
              // Actually, to keep it simple and fix the drag menu, 
              // let's only rebuild if the selection is within a small buffer of any entity syntax.
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
            // 🆕 Handle clicks on widgets to enable editing
            mousedown: (view, event) => {
              const target = event.target as HTMLElement;

              if (target.getAttribute('data-editable-widget') === 'true') {
                // User clicked on a widget - find its position and place cursor there
                const pos = view.posAtDOM(target, 0);
                const tr = view.state.tr.setSelection(
                  Selection.near(view.state.doc.resolve(pos))
                );
                view.dispatch(tr);
                // Removed event.preventDefault() to allow the event to flow to other parts of the system
                // if they are listening for bubble selection/drag events.
                return true;
              }

              return false;
            },

            click: (view, event) => {
              const target = event.target as HTMLElement;

              // Handle wikilink clicks (when NOT in edit mode)
              const wikilinkTitle = target.getAttribute('data-wikilink-title');
              if (wikilinkTitle && options.onWikilinkClick && !target.classList.contains('wikilink-editing')) {
                event.preventDefault();
                event.stopPropagation();
                options.onWikilinkClick(wikilinkTitle);
                return true;
              }

              // Handle temporal clicks
              const temporalText = target.getAttribute('data-temporal');
              if (temporalText && options.onTemporalClick) {
                event.preventDefault();
                event.stopPropagation();
                options.onTemporalClick(temporalText);
                return true;
              }

              // Handle backlink clicks (when NOT in edit mode)
              const backlinkTitle = target.getAttribute('data-backlink-title');
              if (backlinkTitle && options.onBacklinkClick && !target.classList.contains('backlink-editing')) {
                event.preventDefault();
                event.stopPropagation();
                options.onBacklinkClick(backlinkTitle);
                return true;
              }

              // Handle NER clicks
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

              return false;
            },
          },
        },
      }),
    ];
  },
});
