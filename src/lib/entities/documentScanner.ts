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
import type { ParsedEntity, ScanResult, RegisteredEntity } from './types/registry';
import type { EntityKind } from './entityTypes';
import { autoSaveEntityRegistry } from '@/lib/storage/entityStorage';

// Phase 2 Imports
import { extractionService } from '@/lib/extraction/ExtractionService';
import { promptTemplateBuilder } from '@/lib/extraction/PromptTemplateBuilder';
import type { StructuredExtraction } from '@/lib/extraction/ExtractionService';

// Phase 3 Imports - Ref System
import { refParser, type Ref, type ParseContext, isEntityRef, isWikilinkRef, isBacklinkRef, isTagRef, isMentionRef, isTripleRef } from '@/lib/refs';
import type { EntityRefPayload, WikilinkRefPayload, TripleRefPayload, TagRefPayload, MentionRefPayload } from '@/lib/refs';

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

// ==================== PHASE 3: REF-BASED SCANNING ====================

/**
 * Scan document using the new Ref system
 * Returns an array of Ref objects for all detected patterns
 */
export function scanDocumentRefs(
  noteId: string,
  content: JSONContent
): Ref[] {
  const plainText = extractPlainTextFromDocument(content);
  const context: ParseContext = {
    noteId,
    fullText: plainText,
    position: 0,
  };

  return refParser.parse(plainText, context);
}

/**
 * Convert Refs to legacy DocumentConnections format
 * Provides backward compatibility with existing consumers
 */
export function refsToDocumentConnections(refs: Ref[]): DocumentConnections {
  const connections: DocumentConnections = {
    tags: [],
    mentions: [],
    links: [],
    wikilinks: [],
    entities: [],
    triples: [],
    backlinks: [],
  };

  for (const ref of refs) {
    if (isEntityRef(ref)) {
      const payload = ref.payload as EntityRefPayload;
      connections.entities.push({
        kind: payload.entityKind,
        label: ref.target,
        subtype: payload.subtype,
        positions: ref.positions.map(p => p.offset),
      });
    } else if (isWikilinkRef(ref)) {
      if (!connections.wikilinks.includes(ref.target)) {
        connections.wikilinks.push(ref.target);
      }
    } else if (isBacklinkRef(ref)) {
      if (!connections.backlinks.includes(ref.target)) {
        connections.backlinks.push(ref.target);
      }
    } else if (isTagRef(ref)) {
      const payload = ref.payload as TagRefPayload;
      if (!connections.tags.includes(payload.normalized)) {
        connections.tags.push(payload.normalized);
      }
    } else if (isMentionRef(ref)) {
      const payload = ref.payload as MentionRefPayload;
      const mention = payload.displayName || ref.target;
      if (!connections.mentions.includes(mention)) {
        connections.mentions.push(mention);
      }
    } else if (isTripleRef(ref)) {
      const payload = ref.payload as TripleRefPayload;
      connections.triples.push({
        subject: { kind: payload.subjectKind, label: payload.subjectLabel },
        predicate: ref.predicate || '',
        object: { kind: payload.objectKind, label: payload.objectLabel },
      });
    }
  }

  return connections;
}

/**
 * Hybrid scan using new Ref system with fallback to legacy
 * Use this for a gradual migration path
 */
export function scanDocumentHybrid(
  noteId: string,
  content: JSONContent
): { refs: Ref[]; connections: DocumentConnections } {
  const refs = scanDocumentRefs(noteId, content);
  const connections = refsToDocumentConnections(refs);
  return { refs, connections };
}

// ==================== PHASE 1: NEW FUNCTIONS ====================

/**
 * Parse explicit entities from document WITH context
 * Phase 1: Uses RegexEntityParser
 */
export function parseExplicitEntities(content: JSONContent): ParsedEntity[] {
  return regexEntityParser.parseFromDocument(content);
}

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
      // Update entity statistics (idempotent)
      entityRegistry.updateNoteMentions(entity.id, noteId, positions.length);

      matchedEntities.push({
        entity,
        positions,
      });
    } else {
      // Clear mentions for this note if none found anymore
      entityRegistry.updateNoteMentions(entity.id, noteId, 0);
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

// ==================== PHASE 2: ML-POWERED FUNCTIONS ====================

/**
 * Entity suggestion from extraction
 */
export interface EntitySuggestion {
  label: string;
  kind: EntityKind;
  confidence: number;
  context: string;
  action: 'suggest' | 'auto-register';
}

/**
 * Unified document scan WITH extraction LLM (Phase 2)
 * Falls back to regex-only if model not loaded
 */
export async function scanDocumentWithExtraction(
  noteId: string,
  content: JSONContent,
  options: {
    useExtraction?: boolean;
    autoRegisterHighConfidence?: boolean;
    confidenceThreshold?: number;
  } = {}
): Promise<ScanResult & { suggestions: EntitySuggestion[] }> {
  const {
    useExtraction = false,
    autoRegisterHighConfidence = false,
    confidenceThreshold = 0.7,
  } = options;

  // STEP 1: Run standard explicit scan first (ALWAYS)
  const baseResult = scanDocument(noteId, content);

  const suggestions: EntitySuggestion[] = [];

  // STEP 2: Run extraction LLM (Phase 2 - optional)
  if (useExtraction && extractionService.isLoaded() && extractionService.getCurrentModel() === 'extraction') {
    try {
      const plainText = extractPlainTextFromDocument(content);

      // Build prompt from document context
      const systemPrompt = promptTemplateBuilder.buildSystemPrompt({
        explicitEntities: baseResult.explicitEntities.map(e => ({
          label: e.label,
          kind: e.kind,
        })),
        registryEntities: entityRegistry.getAllEntities(),
        includeRelationships: true,
        includeCoOccurrences: true,
      });

      // Run extraction
      const extractedData: StructuredExtraction = await extractionService.extractStructured(
        plainText,
        systemPrompt
      );

      // STEP 3: Process extracted entities into suggestions
      for (const extracted of extractedData.entities) {
        // Skip if already registered
        const existing = entityRegistry.findEntity(extracted.label);
        if (existing) continue;

        // Skip if confidence too low
        if (extracted.confidence < 0.4) continue;

        // Auto-register high confidence entities
        if (autoRegisterHighConfidence && extracted.confidence >= confidenceThreshold) {

          // Register and track
          const entity = entityRegistry.registerEntity(
            extracted.label,
            extracted.kind,
            noteId
          );

          // Add to base result (mutate/update)
          // Note: In real setup, we might need to be careful about mutating baseResult
          // For now, it's fine as we are returning a composite
          // baseResult.baseResult.registeredEntities isn't updated ref-wise in this strict sense
          // but the registry itself IS updated.
        } else {
          // Add as suggestion
          suggestions.push({
            label: extracted.label,
            kind: extracted.kind,
            confidence: extracted.confidence,
            context: '', // TODO: Extract context snippet from text around entity
            action: 'suggest',
          });
        }
      }

      // STEP 4: Process relationships (Auto-learn)
      for (const rel of extractedData.relationships) {
        entityRegistry.addRelationship(
          rel.source,
          rel.target,
          rel.type,
          noteId
        );
      }

      // STEP 5: Process co-occurrences (Auto-learn)
      for (const coOcc of extractedData.coOccurrences) {
        entityRegistry.recordCoOccurrence(
          coOcc.entities,
          coOcc.context,
          noteId
        );
      }

      // Persist learned relationships/co-occurrences
      if (extractedData.relationships.length > 0 || extractedData.coOccurrences.length > 0) {
        autoSaveEntityRegistry(entityRegistry);
      }

    } catch (error) {
      console.error('Extraction failed:', error);
      // Continue with regex-only results if ML fails
    }
  }

  // STEP 6: Return complete scan result
  return {
    ...baseResult,
    suggestions,
    // Note: relationships/coOccurrences in baseResult are currently empty arrays,
    // but the Registry has been updated with them.
    // If we want to return them here, we should pull from registry or the extractions.
    // For now, we follow the pattern that the Registry is the Source of Truth.
  };
}
