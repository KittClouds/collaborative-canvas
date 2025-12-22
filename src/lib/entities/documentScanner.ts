/**
 * DocumentScanner - Unified document processing
 * 
 * Phase 0: Contains existing parsing functions (unchanged)
 * Phase 1: Will add registry-based scanning
 * Phase 2: Will integrate extraction service
 * 
 * All existing functions remain backward compatible.
 */

import type { JSONContent } from '@tiptap/react';
import type { DocumentConnections, Entity, EntityReference } from './entityTypes';
import { regexEntityParser } from './regex-entity-parser';
import { entityRegistry } from './entity-registry';
import type { ParsedEntity, ScanResult } from './types/registry';
import type { EntityKind } from './entityTypes';

// ==================== EXISTING FUNCTIONS (UNCHANGED) ====================

/**
 * Parse connections from TipTap JSONContent structure
 * Extracts entities, tags, mentions, links from the document
 * 
 * ✅ Phase 0: Unchanged - all existing consumers still work
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

  // Dedupe entities by kind+subtype+label, merging positions
  const entityMap = new Map<string, EntityReference>();
  for (const entity of connections.entities) {
    const key = `${entity.kind}:${entity.subtype || ''}|${entity.label}`;
    const existing = entityMap.get(key);
    if (existing) {
      // Merge positions
      existing.positions = [...(existing.positions || []), ...(entity.positions || [])];
    } else {
      entityMap.set(key, { ...entity });
    }
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

  // Extract raw entities ([KIND:SUBTYPE|Label] or [KIND|Label]) with positions
  const entityRegex = /\[([A-Z_]+)(?::([A-Z_]+))?\|([^\]]+?)(?:\|({.*?}))?\]/g;
  let entityMatch: RegExpExecArray | null;
  while ((entityMatch = entityRegex.exec(text)) !== null) {
    const [, kind, subtype, label, attrsJSON] = entityMatch;
    const entity: EntityReference = {
      kind: kind as EntityKind,
      subtype: subtype || undefined,
      label,
      positions: [entityMatch.index],
    };
    if (attrsJSON) {
      try {
        entity.attributes = JSON.parse(attrsJSON.replace(/'/g, '"'));
      } catch {
        // Ignore parse errors
      }
    }
    connections.entities.push(entity);
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
      // Check for any raw entity patterns (including subtype syntax)
      if (
        /\[[A-Z_]+(?::[A-Z_]+)?\|[^\]]+\]/.test(text) || // Entity syntax with optional subtype
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

// ==================== PHASE 1: NEW FUNCTIONS ====================

/**
 * Parse explicit entities from document WITH context
 * Phase 1: Uses RegexEntityParser
 */
export function parseExplicitEntities(content: JSONContent): ParsedEntity[] {
  return regexEntityParser.parseFromDocument(content);
}

import { autoSaveEntityRegistry } from '@/lib/storage/entityStorage';

/**
 * Unified document scan - explicit parsing + registry matching
 * Phase 1: No ML, pure regex + registry lookups
 */
export function scanDocument(
  noteId: string,
  content: JSONContent
): ScanResult {
  // STEP 1: Parse explicit entity syntax
  const explicitEntities = parseExplicitEntities(content);

  // STEP 2: Register explicit entities
  // Note: entityRegistry.registerEntity returns RegisteredEntity 
  // (or similar compat types, ensuring TS check passes)
  const registeredEntities: any[] = [];

  for (const parsed of explicitEntities) {
    const entity = entityRegistry.registerEntity(
      parsed.label,
      parsed.kind,
      noteId,
      {
        subtype: parsed.subtype,
        metadata: parsed.metadata,
        aliases: parsed.metadata?.aliases as string[] | undefined,
      }
    );
    registeredEntities.push(entity);
  }

  // STEP 3: Scan for registered entities in plain text
  const plainText = extractPlainTextFromDocument(content);
  const matchedEntities: ScanResult['matchedEntities'] = [];

  for (const entity of entityRegistry.getAllEntities()) {
    const positions = findEntityMentions(plainText, entity.label, entity.aliases);

    if (positions.length > 0) {
      // Update entity statistics
      entity.totalMentions += positions.length;
      entity.lastSeenDate = new Date();
      entity.noteAppearances.add(noteId);

      matchedEntities.push({
        entity,
        positions,
      });
    }
  }

  // TRIGGER AUTO-SAVE if any changes occurred
  if (explicitEntities.length > 0 || matchedEntities.length > 0) {
    autoSaveEntityRegistry(entityRegistry);
  }

  // STEP 4: Return scan result
  return {
    explicitEntities,
    registeredEntities: entityRegistry.getAllEntities(),
    matchedEntities,
    relationships: [], // Phase 3
    coOccurrences: [], // Phase 3
  };
}

/**
 * Extract plain text from document (helper)
 */
function extractPlainTextFromDocument(node: JSONContent): string {
  if (!node) return '';

  if (node.type === 'text' && node.text) {
    return node.text;
  }

  if (node.content && Array.isArray(node.content)) {
    return node.content.map(child => extractPlainTextFromDocument(child)).join(' ');
  }

  return '';
}

/**
 * Find all positions where entity (or its aliases) appear
 */
function findEntityMentions(
  text: string,
  label: string,
  aliases: string[] = []
): number[] {
  const positions: number[] = [];
  const patterns = [label, ...aliases];

  for (const pattern of patterns) {
    // Word boundary regex for whole-word matching
    const regex = new RegExp(`\\b${escapeRegex(pattern)}\\b`, 'gi');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      positions.push(match.index);
    }
  }

  return positions.sort((a, b) => a - b);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
