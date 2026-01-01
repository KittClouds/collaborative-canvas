import type { CozoEntity, CozoMention } from '../types';
import { ENTITY_KINDS } from '@/lib/types/entityTypes';
import { generateId } from '@/lib/utils/ids';

export interface EntityMatch {
    kind: string;
    subtype?: string;
    label: string;
    charPosition: number;
    context: string;
    attributes?: Record<string, any>;
}

/**
 * Extract entities from episode text using regex patterns
 */
export function extractEntitiesFromText(
    text: string,
    episodeId: string,
    groupId: string,
    scopeType: 'note' | 'folder' | 'vault'
): { entities: CozoEntity[], mentions: CozoMention[] } {
    const matches: EntityMatch[] = [];

    // Pattern 1: [KIND:SUBTYPE|Label] or [KIND:SUBTYPE|Label|{attrs}]
    const fullPattern = /\[([A-Z_]+)(?::([A-Z_]+))?\|([^|\]]+?)(?:\|({[^}]*}))?\]/g;
    let match: RegExpExecArray | null;

    while ((match = fullPattern.exec(text)) !== null) {
        const [fullMatch, kind, subtype, label, attrsJSON] = match;

        if (!ENTITY_KINDS.includes(kind as any)) {
            console.warn(`Unknown entity kind: ${kind}`);
            continue;
        }

        let attributes: Record<string, any> | undefined;
        if (attrsJSON) {
            try {
                // Allow single quotes in attributes JSON
                attributes = JSON.parse(attrsJSON.replace(/'/g, '"'));
            } catch (e) {
                console.error('Failed to parse attributes:', attrsJSON);
            }
        }

        matches.push({
            kind,
            subtype,
            label: label.trim(),
            charPosition: match.index,
            context: extractContext(text, match.index, 50),
            attributes,
        });
    }

    // Pattern 2: [[Wikilink]] → CONCEPT entity
    const wikilinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    while ((match = wikilinkPattern.exec(text)) !== null) {
        const [, target, displayText] = match;
        matches.push({
            kind: 'CONCEPT',
            label: displayText || target,
            charPosition: match.index,
            context: extractContext(text, match.index, 50),
        });
    }

    // Pattern 3: #tag → TAG entity (special kind for now)
    const tagPattern = /#([a-zA-Z0-9_-]+)/g;
    while ((match = tagPattern.exec(text)) !== null) {
        matches.push({
            kind: 'CONCEPT',
            subtype: 'TAG',
            label: match[1],
            charPosition: match.index,
            context: extractContext(text, match.index, 50),
        });
    }

    // Deduplicate entities by (kind, subtype, label) within this episode
    const entityMap = new Map<string, { entity: CozoEntity, mentions: CozoMention[] }>();

    for (const match of matches) {
        const key = `${match.kind}:${match.subtype || ''}:${match.label}`;

        if (!entityMap.has(key)) {
            const entityId = generateId();
            const entity: CozoEntity = {
                id: entityId,
                name: match.label,
                entityKind: match.kind as any,
                entitySubtype: match.subtype,
                groupId,
                scopeType,
                createdAt: new Date(),
                extractionMethod: 'regex',
                aliases: [],
                frequency: 0,
                participants: [],
                attributes: match.attributes,
            };

            entityMap.set(key, { entity, mentions: [] });
        }

        // Create mention record
        const { entity } = entityMap.get(key)!;
        const mention: CozoMention = {
            id: generateId(),
            episodeId,
            entityId: entity.id,
            context: match.context,
            charPosition: match.charPosition,
            confidence: 1.0,
            extractionMethod: 'regex',
            createdAt: new Date(),
        };

        entityMap.get(key)!.mentions.push(mention);
    }

    // Flatten results
    const entities: CozoEntity[] = [];
    const mentions: CozoMention[] = [];

    for (const { entity, mentions: entityMentions } of entityMap.values()) {
        entity.frequency = entityMentions.length;
        entities.push(entity);
        mentions.push(...entityMentions);
    }

    return { entities, mentions };
}

/**
 * Extract context around a match position
 */
function extractContext(text: string, position: number, radius: number): string {
    const start = Math.max(0, position - radius);
    const end = Math.min(text.length, position + radius);
    let context = text.slice(start, end);

    // Add ellipsis if truncated
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';

    return context;
}
