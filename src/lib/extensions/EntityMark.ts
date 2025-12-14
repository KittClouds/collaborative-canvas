import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EntityKind, ENTITY_KINDS, ENTITY_COLORS } from '../entities/entityTypes';

export interface EntityMarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    entityMark: {
      setEntity: (kind: EntityKind, label: string, attributes?: Record<string, any>) => ReturnType;
      unsetEntity: () => ReturnType;
    };
  }
}

// Helper function to build decorations from document
function buildEntityDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text;
      // Match entity syntax: [KIND|Label] or [KIND:SUBTYPE|Label]
      const regex = /\[([A-Z_]+(?::[A-Z_]+)?)\|([^\]]+)\]/g;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const [fullMatch, kindWithSubtype] = match;
        // Extract the base kind (before any colon)
        const kind = kindWithSubtype.split(':')[0];

        if (ENTITY_KINDS.includes(kind as EntityKind)) {
          const from = pos + match.index;
          const to = from + fullMatch.length;
          const color = ENTITY_COLORS[kind as EntityKind] || '#6b7280';

          decorations.push(
            Decoration.inline(from, to, {
              class: 'entity-highlight',
              style: `background-color: ${color}20; color: ${color}; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; cursor: pointer;`,
              'data-kind': kindWithSubtype,
            }, { inclusiveStart: false, inclusiveEnd: false })
          );
        }
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

const entityPluginKey = new PluginKey('entity-auto-detect');

export const EntityMark = Mark.create<EntityMarkOptions>({
  name: 'entity',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      kind: {
        default: null,
        parseHTML: element => element.getAttribute('data-kind'),
        renderHTML: attributes => {
          if (!attributes.kind) return {};
          return { 'data-kind': attributes.kind };
        },
      },
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-label'),
        renderHTML: attributes => {
          if (!attributes.label) return {};
          return { 'data-label': attributes.label };
        },
      },
      attributes: {
        default: null,
        parseHTML: element => {
          const attrs = element.getAttribute('data-attributes');
          return attrs ? JSON.parse(attrs) : null;
        },
        renderHTML: attributes => {
          if (!attributes.attributes) return {};
          return { 'data-attributes': JSON.stringify(attributes.attributes) };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-entity]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const kind = HTMLAttributes['data-kind'] as EntityKind;
    const color = ENTITY_COLORS[kind] || '#6b7280';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-entity': 'true',
        class: 'entity-mark',
        style: `background-color: ${color}20; color: ${color}; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em;`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setEntity:
        (kind, label, attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, { kind, label, attributes });
        },
      unsetEntity:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: entityPluginKey,
        state: {
          init(_, { doc }) {
            return buildEntityDecorations(doc);
          },
          apply(tr, oldDecorations) {
            // Only rebuild decorations if document changed
            if (!tr.docChanged) {
              return oldDecorations.map(tr.mapping, tr.doc);
            }
            return buildEntityDecorations(tr.doc);
          },
        },
        props: {
          decorations(state) {
            return entityPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
