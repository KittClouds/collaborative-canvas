import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface WikiLinkMarkOptions {
  HTMLAttributes: Record<string, any>;
  onLinkClick?: (title: string) => void;
  checkLinkExists?: (title: string) => boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLinkMark: {
      setWikiLink: (title: string) => ReturnType;
      unsetWikiLink: () => ReturnType;
    };
  }
}

// Helper function to build decorations from document
function buildWikiLinkDecorations(
  doc: ProseMirrorNode,
  checkLinkExists?: (title: string) => boolean
): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      // Match [[Page Title]] or [[Page Title|Display Text]]
      const regex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
      let match;

      while ((match = regex.exec(node.text)) !== null) {
        const from = pos + match.index;
        const to = from + match[0].length;
        const title = match[1].trim();

        // Check if the link target exists
        const exists = checkLinkExists ? checkLinkExists(title) : true;

        // Different styling for existing vs broken links
        const baseStyle = 'padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; cursor: pointer;';
        const existingStyle = `${baseStyle} background-color: hsl(var(--primary) / 0.15); color: hsl(var(--primary)); text-decoration: underline; text-decoration-style: dotted;`;
        const brokenStyle = `${baseStyle} background-color: hsl(var(--destructive) / 0.15); color: hsl(var(--destructive)); text-decoration: underline; text-decoration-style: dashed;`;

        decorations.push(
          Decoration.inline(from, to, {
            class: exists ? 'wikilink-highlight wikilink-exists' : 'wikilink-highlight wikilink-broken',
            style: exists ? existingStyle : brokenStyle,
            'data-wikilink-title': title,
            'data-wikilink-exists': exists ? 'true' : 'false',
          }, { inclusiveStart: false, inclusiveEnd: false })
        );
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

const wikiLinkPluginKey = new PluginKey('wikilink-auto-detect');

export const WikiLinkMark = Mark.create<WikiLinkMarkOptions>({
  name: 'wikilink',

  addOptions() {
    return {
      HTMLAttributes: {},
      onLinkClick: undefined as ((title: string) => void) | undefined,
      checkLinkExists: undefined as ((title: string) => boolean) | undefined,
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
        style: 'background-color: hsl(var(--primary) / 0.15); color: hsl(var(--primary)); padding: 2px 6px; border-radius: 4px; font-weight: 500; font-size: 0.875em; text-decoration: underline; text-decoration-style: dotted; cursor: pointer;',
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
    const options = this.options;

    return [
      new Plugin({
        key: wikiLinkPluginKey,
        state: {
          init(_, { doc }) {
            return buildWikiLinkDecorations(doc, options.checkLinkExists);
          },
          apply(tr, oldDecorations) {
            // Only rebuild decorations if document changed
            if (!tr.docChanged) {
              return oldDecorations.map(tr.mapping, tr.doc);
            }
            return buildWikiLinkDecorations(tr.doc, options.checkLinkExists);
          },
        },
        props: {
          decorations(state) {
            return wikiLinkPluginKey.getState(state);
          },

          // Handle clicks on wikilinks
          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target as HTMLElement;
              const wikilinkTitle = target.getAttribute('data-wikilink-title');

              if (wikilinkTitle && options.onLinkClick) {
                event.preventDefault();
                event.stopPropagation();
                options.onLinkClick(wikilinkTitle);
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
