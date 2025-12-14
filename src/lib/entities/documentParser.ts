import type { JSONContent } from '@tiptap/react';
import type { DocumentConnections, Entity, EntityKind } from './entityTypes';

/**
 * Parse connections from TipTap JSONContent structure
 * Extracts entities, tags, mentions, links from the document
 */
export function parseNoteConnectionsFromDocument(
  content: JSONContent,
): DocumentConnections {
  const connections: DocumentConnections = {
    tags: [],
    mentions: [],
    links: [],
    wikilinks: [],
    entities: [],
    triples: [],
    backlinks: [],
  };

  const walkNode = (node: JSONContent) => {
    // Process marks (inline formatting/annotations)
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'entity':
            if (mark.attrs?.kind && mark.attrs?.label) {
              const entity: Entity = {
                kind: mark.attrs.kind,
                label: mark.attrs.label,
              };
              if (mark.attrs.attributes) {
                entity.attributes = mark.attrs.attributes;
              }
              connections.entities.push(entity);
            }
            break;

          case 'tag':
            if (mark.attrs?.tag) {
              connections.tags.push(mark.attrs.tag);
            }
            break;

          case 'mention':
            if (mark.attrs?.id) {
              connections.mentions.push(mark.attrs.id);
            }
            break;

          case 'link':
            if (mark.attrs?.href) {
              connections.links.push(mark.attrs.href);
            }
            break;
        }
      }
    }

    // Check for custom node types
    if (node.type === 'wikilink' && node.attrs?.title) {
      connections.wikilinks.push(node.attrs.title);
    }

    if (node.type === 'backlink' && node.attrs?.title) {
      connections.backlinks.push(node.attrs.title);
    }

    // Extract raw syntax from text content
    if (node.type === 'text' && node.text) {
      extractRawSyntax(node.text, connections);
    }

    // Recursively process child nodes
    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        walkNode(child);
      }
    }
  };

  // Start walking from root
  if (content.content) {
    for (const node of content.content) {
      walkNode(node);
    }
  }

  // Remove duplicates
  connections.tags = [...new Set(connections.tags)];
  connections.mentions = [...new Set(connections.mentions)];
  connections.links = [...new Set(connections.links)];
  connections.wikilinks = [...new Set(connections.wikilinks)];
  connections.backlinks = [...new Set(connections.backlinks)];

  // Dedupe entities by kind+label
  const entityMap = new Map<string, Entity>();
  for (const entity of connections.entities) {
    const key = `${entity.kind}|${entity.label}`;
    entityMap.set(key, entity);
  }
  connections.entities = Array.from(entityMap.values());

  return connections;
}

/**
 * Extract raw syntax patterns from plain text
 */
function extractRawSyntax(text: string, connections: DocumentConnections) {
  // Extract raw tags (#tagname)
  const tagMatches = text.match(/#(\w+)/g);
  if (tagMatches) {
    for (const match of tagMatches) {
      const tag = match.slice(1);
      if (!connections.tags.includes(tag)) {
        connections.tags.push(tag);
      }
    }
  }

  // Extract raw mentions (@username)
  const mentionMatches = text.match(/@(\w+)/g);
  if (mentionMatches) {
    for (const match of mentionMatches) {
      const mention = match.slice(1);
      if (!connections.mentions.includes(mention)) {
        connections.mentions.push(mention);
      }
    }
  }

  // Extract raw wiki links ([[Page Title]])
  const linkMatches = text.match(/\[\[\s*([^\]\s|][^\]|]*?)\s*(?:\|[^\]]*)?\]\]/g);
  if (linkMatches) {
    for (const match of linkMatches) {
      const linkMatch = match.match(/\[\[\s*([^\]\s|][^\]|]*?)\s*(?:\|[^\]]*)?\]\]/);
      if (linkMatch) {
        const link = linkMatch[1].trim();
        if (!connections.wikilinks.includes(link)) {
          connections.wikilinks.push(link);
        }
      }
    }
  }

  // Extract raw entities ([KIND|Label])
  const entityMatches = text.match(/\[([A-Z_]+)\|([^\]]+?)(?:\|({.*?}))?\]/g);
  if (entityMatches) {
    for (const match of entityMatches) {
      const entityMatch = match.match(/\[([A-Z_]+)\|([^\]]+?)(?:\|({.*?}))?\]/);
      if (entityMatch) {
        const [, kind, label, attrsJSON] = entityMatch;
        const entity: Entity = { kind: kind as EntityKind, label };
        if (attrsJSON) {
          try {
            entity.attributes = JSON.parse(attrsJSON.replace(/'/g, '"'));
          } catch {
            // Ignore parse errors
          }
        }
        connections.entities.push(entity);
      }
    }
  }

  // Extract raw backlinks (<<Page Title>>)
  const backlinkMatches = text.match(/<<\s*([^>\s|][^>|]*?)\s*(?:\|[^>]*)?>>/g);
  if (backlinkMatches) {
    for (const match of backlinkMatches) {
      const backlinkMatch = match.match(/<<\s*([^>\s|][^>|]*?)\s*(?:\|[^>]*)?>>/);
      if (backlinkMatch) {
        const backlink = backlinkMatch[1].trim();
        if (!connections.backlinks.includes(backlink)) {
          connections.backlinks.push(backlink);
        }
      }
    }
  }

  // Extract raw triples ([KIND|Label] ->PREDICATE-> [KIND|Label])
  const triplePattern = /\[([A-Z_]+)\|([^\]]+)\]\s*->([A-Z_]+)->\s*\[([A-Z_]+)\|([^\]]+)\]/g;
  let tripleMatch: RegExpExecArray | null;
  while ((tripleMatch = triplePattern.exec(text)) !== null) {
    const [, subjectKind, subjectLabel, predicate, objectKind, objectLabel] = tripleMatch;
    connections.triples.push({
      subject: { kind: subjectKind as EntityKind, label: subjectLabel.trim() },
      predicate: predicate,
      object: { kind: objectKind as EntityKind, label: objectLabel.trim() },
    });
  }
}

/**
 * Check if document contains any raw (unconverted) entity syntax
 */
export function hasRawEntitySyntax(content: JSONContent): boolean {
  const walkNode = (node: JSONContent): boolean => {
    if (node.type === 'text' && node.text) {
      const text = node.text;
      // Check for any raw entity patterns
      if (
        /\[[A-Z_]+\|[^\]]+\]/.test(text) || // Entity syntax
        /\[\[\s*[^\]]+\s*\]\]/.test(text) || // Wiki links
        /<<\s*[^>]+\s*>>/.test(text) || // Backlinks
        /#\w+/.test(text) || // Tags
        /@\w+/.test(text) // Mentions
      ) {
        return true;
      }
    }

    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        if (walkNode(child)) return true;
      }
    }

    return false;
  };

  return walkNode(content);
}
