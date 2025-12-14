import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface MentionMarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mentionMark: {
      setMention: (id: string) => ReturnType;
      unsetMention: () => ReturnType;
    };
  }
}

export const MentionMarkExt = Mark.create<MentionMarkOptions>({
  name: 'mentionMark',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-mention-id'),
        renderHTML: attributes => {
          if (!attributes.id) return {};
          return { 'data-mention-id': attributes.id };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-mention-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'mention-mark',
        style: 'background-color: #10b98120; color: #10b981; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em;',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setMention:
        (id: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { id });
        },
      unsetMention:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('mention-auto-detect'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                const regex = /@(\w+)/g;
                let match;

                while ((match = regex.exec(node.text)) !== null) {
                  const from = pos + match.index;
                  const to = from + match[0].length;

                  decorations.push(
                    Decoration.inline(from, to, {
                      class: 'mention-highlight',
                      style: 'background-color: #10b98120; color: #10b981; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; cursor: pointer;',
                      'data-mention-id': match[1],
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
