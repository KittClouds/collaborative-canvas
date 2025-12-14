import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

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

// Helper function to build decorations from document
function buildMentionDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

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
          }, { inclusiveStart: false, inclusiveEnd: false })
        );
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

const mentionPluginKey = new PluginKey('mention-auto-detect');

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
        key: mentionPluginKey,
        state: {
          init(_, { doc }) {
            return buildMentionDecorations(doc);
          },
          apply(tr, oldDecorations) {
            // Only rebuild decorations if document changed
            if (!tr.docChanged) {
              return oldDecorations.map(tr.mapping, tr.doc);
            }
            return buildMentionDecorations(tr.doc);
          },
        },
        props: {
          decorations(state) {
            return mentionPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
