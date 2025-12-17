import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EntityKind, ENTITY_KINDS, ENTITY_COLORS } from '../entities/entityTypes';
import type { NEREntity } from '../ner/types';

export interface UnifiedSyntaxOptions {
  onWikilinkClick?: (title: string) => void;
  checkWikilinkExists?: (title: string) => boolean;
  onTemporalClick?: (temporal: string) => void;
  nerEntities?: NEREntity[] | (() => NEREntity[]); // Support array or getter function
  onNEREntityClick?: (entity: NEREntity) => void;
}

const syntaxPluginKey = new PluginKey('unified-syntax-highlighter');

/**
 * Single decoration builder for ALL syntax types.
 * Processes in priority order to avoid overlaps:
 * 1. Entities [KIND:SUBTYPE|Label] or [KIND|Label]
 * 2. WikiLinks [[Page Title]]
 * 3. Tags #hashtag
 * 4. Mentions @username
 */
function buildAllDecorations(
  doc: ProseMirrorNode,
  options: UnifiedSyntaxOptions
): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    const text = node.text;

    // Track character positions already decorated to prevent overlaps
    const processed = new Set<number>();

    // 1. Entity syntax: [KIND:SUBTYPE|Label] or [KIND|Label]
    const entityRegex = /\[([A-Z_]+(?::[A-Z_]+)?)\|([^\]]+)\]/g;
    let match;

    while ((match = entityRegex.exec(text)) !== null) {
      const [fullMatch, kind] = match;
      const from = pos + match.index;
      const to = from + fullMatch.length;

      // Mark range as processed
      for (let i = match.index; i < match.index + fullMatch.length; i++) {
        processed.add(i);
      }

      const baseKind = kind.split(':')[0] as EntityKind;
      if (ENTITY_KINDS.includes(baseKind)) {
        const color = ENTITY_COLORS[baseKind] || '#6b7280';

        decorations.push(
          Decoration.inline(from, to, {
            class: 'entity-highlight',
            style: `background-color: ${color}20; color: ${color}; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em;`,
            'data-kind': kind,
          }, { inclusiveStart: false, inclusiveEnd: false })
        );
      }
    }

    // 2. WikiLinks: [[Page Title]] or [[Page Title|Display]]
    const wikilinkRegex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

    while ((match = wikilinkRegex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;

      // Skip if overlaps with already processed range
      let hasOverlap = false;
      for (let i = match.index; i < match.index + match[0].length; i++) {
        if (processed.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;

      // Mark as processed
      for (let i = match.index; i < match.index + match[0].length; i++) {
        processed.add(i);
      }

      const title = match[1].trim();
      const exists = options.checkWikilinkExists?.(title) ?? true;

      const baseStyle = 'padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; cursor: pointer;';
      const style = exists
        ? `${baseStyle} background-color: hsl(var(--primary) / 0.15); color: hsl(var(--primary)); text-decoration: underline; text-decoration-style: dotted;`
        : `${baseStyle} background-color: hsl(var(--destructive) / 0.15); color: hsl(var(--destructive)); text-decoration: underline; text-decoration-style: dashed;`;

      decorations.push(
        Decoration.inline(from, to, {
          class: exists ? 'wikilink-highlight wikilink-exists' : 'wikilink-highlight wikilink-broken',
          style,
          'data-wikilink-title': title,
          'data-wikilink-exists': exists ? 'true' : 'false',
        }, { inclusiveStart: false, inclusiveEnd: false })
      );
    }

    // 3. Tags: #hashtag
    const tagRegex = /#(\w+)/g;

    while ((match = tagRegex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;

      // Skip if overlaps
      let hasOverlap = false;
      for (let i = match.index; i < match.index + match[0].length; i++) {
        if (processed.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;

      // Mark as processed
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

    // 4. Mentions: @username
    const mentionRegex = /@(\w+)/g;

    while ((match = mentionRegex.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;

      // Skip if overlaps
      let hasOverlap = false;
      for (let i = match.index; i < match.index + match[0].length; i++) {
        if (processed.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) continue;

      // Mark as processed
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

    // 5. Temporal expressions: "three days later", "next morning", etc.
    const temporalPatterns = [
      // Relative time: "X days/weeks/hours later/before/after"
      /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(second|minute|hour|day|week|month|year)s?\s+(later|before|after|earlier|ago)\b/gi,
      // Next/last patterns: "next morning", "last night"
      /\b(next|last|the following|the previous)\s+(morning|afternoon|evening|night|day|week|month|year|dawn|dusk|midnight|noon)\b/gi,
      // Simple time words
      /\b(yesterday|tomorrow|today|tonight|nowadays)\b/gi,
      // Time of day patterns
      /\b(at|by|before|after|around)\s+(dawn|dusk|midnight|noon|sunrise|sunset)\b/gi,
      // Moments patterns
      /\b(moments?|seconds?|minutes?|hours?)\s+(later|before|after|earlier)\b/gi,
      // Meanwhile, eventually, etc.
      /\b(meanwhile|eventually|suddenly|immediately|soon|later|afterwards|beforehand)\b/gi,
      // "In the morning/evening"
      /\b(in the|that)\s+(morning|afternoon|evening|night)\b/gi,
      // Chapter/sequential time hints
      /\b(the next day|the day after|the night before|the morning of|the evening of)\b/gi,
    ];

    for (const temporalRegex of temporalPatterns) {
      // Reset regex state for each pattern
      temporalRegex.lastIndex = 0;

      while ((match = temporalRegex.exec(text)) !== null) {
        const from = pos + match.index;
        const to = from + match[0].length;

        // Skip if overlaps
        let hasOverlap = false;
        for (let i = match.index; i < match.index + match[0].length; i++) {
          if (processed.has(i)) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) continue;

        // Mark as processed
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

    // 6. NER-detected entities (runs last, lowest priority)
    const nerEntities = typeof options.nerEntities === 'function'
      ? options.nerEntities()
      : options.nerEntities || [];

    if (nerEntities.length > 0) {
      for (const entity of nerEntities) {
        // Only process entities within this text node's range
        const entityStart = entity.start;
        const entityEnd = entity.end;
        const nodeStart = pos;
        const nodeEnd = pos + text.length;

        // Check if entity overlaps with this text node
        if (entityEnd <= nodeStart || entityStart >= nodeEnd) continue;

        // Calculate positions relative to this node
        const relativeStart = Math.max(0, entityStart - nodeStart);
        const relativeEnd = Math.min(text.length, entityEnd - nodeStart);

        const from = pos + relativeStart;
        const to = pos + relativeEnd;

        // Skip if overlaps with already processed ranges
        let hasOverlap = false;
        for (let i = relativeStart; i < relativeEnd; i++) {
          if (processed.has(i)) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) continue;

        // Mark as processed
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
      nerEntities: undefined,
      onNEREntityClick: undefined,
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
            // Only rebuild if document content changed, not just selection
            if (!tr.docChanged) {
              // Map existing decorations through the transaction
              return oldDecorations.map(tr.mapping, tr.doc);
            }

            // Document changed - rebuild decorations
            return buildAllDecorations(newState.doc, options);
          },
        },
        props: {
          decorations(state) {
            return syntaxPluginKey.getState(state);
          },

          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target as HTMLElement;

              // Handle wikilink clicks
              const wikilinkTitle = target.getAttribute('data-wikilink-title');
              if (wikilinkTitle && options.onWikilinkClick) {
                event.preventDefault();
                event.stopPropagation();
                options.onWikilinkClick(wikilinkTitle);
                return true;
              }

              // Handle temporal expression clicks
              const temporalText = target.getAttribute('data-temporal');
              if (temporalText && options.onTemporalClick) {
                event.preventDefault();
                event.stopPropagation();
                options.onTemporalClick(temporalText);
                return true;
              }

              // Handle NER entity clicks
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
