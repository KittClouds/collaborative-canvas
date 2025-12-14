import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { EntityKind, ENTITY_KINDS, ENTITY_COLORS } from '../entities/entityTypes';

export interface EntityMarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    entityMark: {
      setEntity: (kind: EntityKind, label: string, attributes?: Record<string, any>) => ReturnType;
      unsetEntity: () => ReturnType;
      toggleEntity: (kind: EntityKind) => ReturnType;
    };
  }
}

export const EntityMark = Mark.create<EntityMarkOptions>({
  name: 'entity',

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      kind: {
        default: 'CONCEPT',
        parseHTML: element => element.getAttribute('data-entity-kind'),
        renderHTML: attributes => {
          if (!attributes.kind) return {};
          return { 'data-entity-kind': attributes.kind };
        },
      },
      label: {
        default: '',
        parseHTML: element => element.getAttribute('data-entity-label'),
        renderHTML: attributes => {
          if (!attributes.label) return {};
          return { 'data-entity-label': attributes.label };
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
    const kind = HTMLAttributes['data-entity-kind'] as EntityKind;
    const color = ENTITY_COLORS[kind] || '#6b7280';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-entity': 'true',
        class: 'entity-mark',
        style: `background-color: ${color}20; color: ${color}; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; border: 1px solid ${color}40;`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setEntity:
        (kind, label, attributes) =>
        ({ commands, state }) => {
          const { from, to } = state.selection;
          const selectedText = state.doc.textBetween(from, to, '');
          const finalLabel = label || selectedText;
          return commands.setMark(this.name, { kind, label: finalLabel, attributes });
        },
      unsetEntity:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      toggleEntity:
        (kind) =>
        ({ commands, state }) => {
          const { from, to } = state.selection;
          const selectedText = state.doc.textBetween(from, to, '');
          const hasEntityMark = state.doc.rangeHasMark(from, to, this.type);
          
          if (hasEntityMark) {
            return commands.unsetMark(this.name);
          }
          
          return commands.setMark(this.name, { kind, label: selectedText });
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('entity-auto-detect'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                const text = node.text;
                const regex = /\[([A-Z_]+)\|([^\]]+)\]/g;
                let match;

                while ((match = regex.exec(text)) !== null) {
                  const [fullMatch, kind] = match;
                  
                  if (ENTITY_KINDS.includes(kind as EntityKind)) {
                    const from = pos + match.index;
                    const to = from + fullMatch.length;
                    const color = ENTITY_COLORS[kind as EntityKind] || '#6b7280';

                    decorations.push(
                      Decoration.inline(from, to, {
                        class: 'entity-highlight',
                        style: `background-color: ${color}15; border-bottom: 2px dashed ${color}; color: ${color}; cursor: pointer;`,
                        'data-kind': kind,
                      })
                    );
                  }
                }
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
