import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface TagMarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tagMark: {
      setTag: (tag: string) => ReturnType;
      unsetTag: () => ReturnType;
    };
  }
}

export const TagMark = Mark.create<TagMarkOptions>({
  name: 'tag',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      tag: {
        default: null,
        parseHTML: element => element.getAttribute('data-tag'),
        renderHTML: attributes => {
          if (!attributes.tag) return {};
          return { 'data-tag': attributes.tag };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-tag]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'tag-mark',
        style: 'background-color: #3b82f620; color: #3b82f6; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em;',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setTag:
        (tag: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { tag });
        },
      unsetTag:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tag-auto-detect'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                const regex = /#(\w+)/g;
                let match;

                while ((match = regex.exec(node.text)) !== null) {
                  const from = pos + match.index;
                  const to = from + match[0].length;

                  decorations.push(
                    Decoration.inline(from, to, {
                      class: 'tag-highlight',
                      style: 'background-color: #3b82f620; color: #3b82f6; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; cursor: pointer;',
                      'data-tag': match[1],
                    })
                  );
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
