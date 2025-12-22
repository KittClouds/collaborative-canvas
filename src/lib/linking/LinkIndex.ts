import type { Note } from '@/contexts/NotesContext';
import type { EntityKind } from '@/lib/entities/entityTypes';
import { scanDocument } from '@/lib/entities/documentScanner';

export interface WikiLink {
  sourceNoteId: string;
  targetTitle: string;
  linkType: 'wikilink' | 'entity' | 'mention';
  entityKind?: EntityKind;
  entityLabel?: string;
  context?: string; // Surrounding text for preview
}

export interface BacklinkInfo {
  sourceNoteId: string;
  sourceNoteTitle: string;
  linkCount: number;
  linkType: 'wikilink' | 'entity' | 'mention';
  context?: string;
}

export class LinkIndex {
  private outgoingLinks: Map<string, WikiLink[]>; // sourceNoteId -> links
  private backlinkMap: Map<string, BacklinkInfo[]>; // normalized target -> backlinks

  constructor() {
    this.outgoingLinks = new Map();
    this.backlinkMap = new Map();
  }

  /**
   * Parse note content (JSON string) and extract all links
   */
  parseNoteLinks(noteId: string, noteTitle: string, content: string): WikiLink[] {
    const links: WikiLink[] = [];

    // Extract plain text from JSON content
    let plainText = '';
    try {
      const doc = JSON.parse(content);
      plainText = this.extractTextFromDoc(doc);
    } catch {
      plainText = content;
    }

    // Parse wikilinks: [[Note Title]] or [[Note Title|Display]]
    const wikilinkRegex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
    let match;
    while ((match = wikilinkRegex.exec(plainText)) !== null) {
      const targetTitle = match[1].trim();
      const context = this.getContext(plainText, match.index, match[0].length);
      links.push({
        sourceNoteId: noteId,
        targetTitle,
        linkType: 'wikilink',
        context,
      });
    }

    // Parse entity mentions: [KIND|Label] or [KIND:SUBTYPE|Label] or [KIND|Label|{attrs}]
    const entityRegex = /\[([A-Z_]+(?::[A-Z_]+)?)\|([^\]|]+)(?:\|[^\]]+)?\]/g;
    while ((match = entityRegex.exec(plainText)) !== null) {
      const fullKind = match[1];
      const entityKind = fullKind.split(':')[0] as EntityKind;
      const entityLabel = match[2].trim();
      const context = this.getContext(plainText, match.index, match[0].length);
      links.push({
        sourceNoteId: noteId,
        targetTitle: entityLabel,
        linkType: 'entity',
        entityKind,
        entityLabel,
        context,
      });
    }

    // Parse @mentions
    const mentionRegex = /@(\w+)/g;
    while ((match = mentionRegex.exec(plainText)) !== null) {
      const context = this.getContext(plainText, match.index, match[0].length);
      links.push({
        sourceNoteId: noteId,
        targetTitle: match[1].trim(),
        linkType: 'mention',
        context,
      });
    }

    // Parse backlinks: <<Title>> or <<[KIND|Label]>>
    const backlinkRegex = /<<([^>]+)>>/g;
    while ((match = backlinkRegex.exec(plainText)) !== null) {
      const rawTitle = match[1].trim();
      const context = this.getContext(plainText, match.index, match[0].length);

      // Check if backlink contains entity syntax (with optional attributes)
      const entityMatch = rawTitle.match(/^\[([A-Z_]+)(?::[A-Z_]+)?\|([^\]|]+)(?:\|[^\]]+)?\]$/);

      if (entityMatch) {
        const entityKind = entityMatch[1] as EntityKind;
        const entityLabel = entityMatch[2].trim();
        links.push({
          sourceNoteId: noteId,
          targetTitle: entityLabel,
          linkType: 'entity',
          entityKind,
          entityLabel,
          context,
        });
      } else {
        links.push({
          sourceNoteId: noteId,
          targetTitle: rawTitle,
          linkType: 'wikilink',
          context,
        });
      }
    }

    return links;
  }

  /**
   * Extract plain text from TipTap JSON document
   */
  private extractTextFromDoc(node: any): string {
    if (!node) return '';

    // If node is already a string (fallback)
    if (typeof node === 'string') return node;

    // Handle text nodes
    if (node.type === 'text' && node.text) {
      return node.text;
    }

    // Handle nodes with content (recursive)
    if (node.content && Array.isArray(node.content)) {
      // Use different join strategies based on node type
      const isBlock = ['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem'].includes(node.type);
      const text = node.content.map((child: any) => this.extractTextFromDoc(child)).join('');
      return isBlock ? text + '\n' : text;
    }

    // Handle special nodes that might contain text in attributes (like task items)
    if (node.type === 'taskItem' && node.content) {
      return node.content.map((child: any) => this.extractTextFromDoc(child)).join('') + '\n';
    }

    return '';
  }

  /**
   * Get surrounding context for a match
   */
  private getContext(text: string, index: number, matchLength: number): string {
    const contextRadius = 40;
    const start = Math.max(0, index - contextRadius);
    const end = Math.min(text.length, index + matchLength + contextRadius);

    let context = text.slice(start, end).trim();
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';

    return context;
  }

  /**
   * Normalize title for matching (case-insensitive)
   */
  private normalizeTitle(title: string): string {
    return title.toLowerCase().trim();
  }

  /**
   * Get the key for backlink lookup
   */
  private getBacklinkKey(targetTitle: string, entityKind?: EntityKind): string {
    if (entityKind) {
      return `entity:${entityKind}:${this.normalizeTitle(targetTitle)}`;
    }
    return `note:${this.normalizeTitle(targetTitle)}`;
  }

  /**
   * Rebuild entire index from notes array
   */
  rebuildIndex(notes: Note[]): void {
    this.outgoingLinks.clear();
    this.backlinkMap.clear();

    // First pass: parse all outgoing links and scan for entities
    for (const note of notes) {
      const links = this.parseNoteLinks(note.id, note.title, note.content);
      this.outgoingLinks.set(note.id, links);

      // Phase 1: Scan for implicit/explicit entities
      try {
        const content = JSON.parse(note.content);
        scanDocument(note.id, content);
      } catch (error) {
        // Ignore parse errors (handled partially by parseNoteLinks already)
      }
    }

    // Second pass: build backlink map
    this.outgoingLinks.forEach((links, sourceNoteId) => {
      const sourceNote = notes.find(n => n.id === sourceNoteId);
      if (!sourceNote) return;

      // Group links by target
      const linksByTarget = new Map<string, WikiLink[]>();
      for (const link of links) {
        const key = this.getBacklinkKey(link.targetTitle, link.entityKind);
        if (!linksByTarget.has(key)) {
          linksByTarget.set(key, []);
        }
        linksByTarget.get(key)!.push(link);
      }

      // Create backlink entries
      linksByTarget.forEach((targetLinks, key) => {
        if (!this.backlinkMap.has(key)) {
          this.backlinkMap.set(key, []);
        }

        this.backlinkMap.get(key)!.push({
          sourceNoteId,
          sourceNoteTitle: sourceNote.title,
          linkCount: targetLinks.length,
          linkType: targetLinks[0].linkType,
          context: targetLinks[0].context,
        });
      });
    });
  }

  /**
   * Get all backlinks for a note
   */
  getBacklinksForNote(note: Note): BacklinkInfo[] {
    const results: BacklinkInfo[] = [];

    // Check by title
    const titleKey = this.getBacklinkKey(note.title);
    const titleBacklinks = this.backlinkMap.get(titleKey) || [];
    results.push(...titleBacklinks);

    // Check by entity label if it's an entity note
    if (note.isEntity && note.entityLabel && note.entityKind) {
      const entityKey = this.getBacklinkKey(note.entityLabel, note.entityKind);
      const entityBacklinks = this.backlinkMap.get(entityKey) || [];

      // Avoid duplicates
      for (const bl of entityBacklinks) {
        if (!results.some(r => r.sourceNoteId === bl.sourceNoteId)) {
          results.push(bl);
        }
      }
    }

    // Filter out self-references
    return results.filter(bl => bl.sourceNoteId !== note.id);
  }

  /**
   * Get all outgoing links from a note
   */
  getOutgoingLinks(noteId: string): WikiLink[] {
    return this.outgoingLinks.get(noteId) || [];
  }

  /**
   * Find a note by title (case-insensitive)
   */
  findNoteByTitle(title: string, notes: Note[]): Note | undefined {
    const normalizedTitle = this.normalizeTitle(title);

    return notes.find(n =>
      this.normalizeTitle(n.title) === normalizedTitle ||
      (n.isEntity && n.entityLabel && this.normalizeTitle(n.entityLabel) === normalizedTitle)
    );
  }

  /**
   * Check if a note with the given title exists
   */
  noteExists(title: string, notes: Note[]): boolean {
    return this.findNoteByTitle(title, notes) !== undefined;
  }

  /**
   * Get all mentions of a specific entity across all notes
   */
  getEntityMentions(
    entityLabel: string,
    entityKind?: EntityKind
  ): BacklinkInfo[] {
    const key = this.getBacklinkKey(entityLabel, entityKind);
    return this.backlinkMap.get(key) || [];
  }

  /**
   * Get all entities mentioned in a note (grouped by entity)
   */
  getEntitiesInNote(noteId: string): Map<string, WikiLink[]> {
    const links = this.outgoingLinks.get(noteId) || [];
    const entityLinks = links.filter(l => l.linkType === 'entity');

    // Group by entity (kind + label)
    const grouped = new Map<string, WikiLink[]>();
    for (const link of entityLinks) {
      const key = `${link.entityKind}:${link.entityLabel}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(link);
    }

    return grouped;
  }

  /**
   * Get entity mention statistics for a note
   */
  getEntityStats(noteId: string): Array<{
    entityKind: EntityKind;
    entityLabel: string;
    mentionsInThisNote: number;
    mentionsAcrossVault: number;
    appearanceCount: number;
  }> {
    const entities = this.getEntitiesInNote(noteId);
    const stats: Array<any> = [];

    entities.forEach((links, key) => {
      const [kind, label] = key.split(':');
      const backlinks = this.getEntityMentions(label, kind as EntityKind);

      stats.push({
        entityKind: kind as EntityKind,
        entityLabel: label,
        mentionsInThisNote: links.length,
        mentionsAcrossVault: backlinks.reduce((sum, bl) => sum + bl.linkCount, 0),
        appearanceCount: backlinks.length,
      });
    });

    return stats;
  }
}


// Singleton instance
export const linkIndex = new LinkIndex();
