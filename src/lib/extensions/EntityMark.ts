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
    };
  }
}

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

  // Decoration plugin removed - now handled by UnifiedSyntaxHighlighter
});
