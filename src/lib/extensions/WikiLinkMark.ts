import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface WikiLinkMarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLinkMark: {
      setWikiLink: (title: string) => ReturnType;
      unsetWikiLink: () => ReturnType;
    };
  }
}

export const WikiLinkMark = Mark.create<WikiLinkMarkOptions>({
  name: 'wikilink',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      title: {
        default: null,
        parseHTML: element => element.getAttribute('data-wikilink-title'),
        renderHTML: attributes => {
          if (!attributes.title) return {};
          return { 'data-wikilink-title': attributes.title };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wikilink-title]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'wikilink-mark',
        style: 'background-color: #6366f120; color: #6366f1; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; text-decoration: underline; text-decoration-style: dotted; cursor: pointer;',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setWikiLink:
        (title: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { title });
        },
      unsetWikiLink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wikilink-auto-detect'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                // Match [[Page Title]] or [[Page Title|Display Text]]
                const regex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
                let match;

                while ((match = regex.exec(node.text)) !== null) {
                  const from = pos + match.index;
                  const to = from + match[0].length;

                  decorations.push(
                    Decoration.inline(from, to, {
                      class: 'wikilink-highlight',
                      style: 'background-color: #6366f120; color: #6366f1; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; text-decoration: underline; text-decoration-style: dotted; cursor: pointer;',
                      'data-wikilink-title': match[1].trim(),
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
