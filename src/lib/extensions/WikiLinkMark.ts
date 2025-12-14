import { Mark, mergeAttributes } from '@tiptap/core';

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

  // Decoration plugin removed - now handled by UnifiedSyntaxHighlighter
});
