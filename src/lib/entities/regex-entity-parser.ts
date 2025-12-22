/**
 * RegexEntityParser - Extract explicit entity syntax from documents
 * 
 * Phase 1: Full implementation
 * Handles:
 * - [KIND|Label]
 * - [KIND:SUBTYPE|Label]
 * - [KIND|Label|{metadata}]
 * - [KIND|Label|{" aliases":["Alias1"]}]
 */

import type { JSONContent } from '@tiptap/react';
import type { EntityKind } from './entityTypes';
import type { ParsedEntity } from './types/registry';

export class RegexEntityParser {
    /**
     * Parse explicit entity declarations from TipTap document
     */
    parseFromDocument(content: JSONContent): ParsedEntity[] {
        const fullText = this.extractPlainText(content);
        return this.parseFromText(fullText);
    }

    /**
     * Parse explicit entity declarations from plain text
     */
    parseFromText(text: string): ParsedEntity[] {
        const entities: ParsedEntity[] = [];

        // Regex for entity syntax: [KIND|Label] or [KIND:SUBTYPE|Label|{attrs}]
        const regex = /\[([A-Z_]+)(?::([A-Z_]+))?\|([^\]|]+)(?:\|(\{[^}]+\}))?\]/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            const [fullMatch, kind, subtype, label, attrsJSON] = match;
            const position = {
                start: match.index,
                end: match.index + fullMatch.length,
            };

            // Extract surrounding context
            const context = this.extractContext(text, position.start, 150);

            // Parse metadata/attributes JSON if present
            let metadata: Record<string, any> | undefined;
            if (attrsJSON) {
                try {
                    // Handle both single and double quotes
                    const normalized = attrsJSON.replace(/'/g, '"');
                    metadata = JSON.parse(normalized);
                } catch (error) {
                    console.warn(`Failed to parse entity metadata: ${attrsJSON}`, error);
                }
            }

            entities.push({
                type: 'explicit',
                kind: kind as EntityKind,
                label: label.trim(),
                subtype: subtype?.trim(),
                metadata,
                position,
                context,
            });
        }

        return entities;
    }

    /**
     * Extract plain text from TipTap JSONContent
     */
    private extractPlainText(node: JSONContent): string {
        if (!node) return '';

        if (node.type === 'text' && node.text) {
            return node.text;
        }

        if (node.content && Array.isArray(node.content)) {
            return node.content.map(child => this.extractPlainText(child)).join(' ');
        }

        return '';
    }

    /**
     * Extract surrounding context for entity
     * @param text - Full text
     * @param position - Position of entity in text
     * @param radius - Characters before/after to include
     */
    private extractContext(text: string, position: number, radius: number): string {
        const start = Math.max(0, position - radius);
        const end = Math.min(text.length, position + radius);

        let context = text.slice(start, end).trim();

        // Add ellipsis if truncated
        if (start > 0) context = '...' + context;
        if (end < text.length) context = context + '...';

        return context;
    }
}

// Singleton instance
export const regexEntityParser = new RegexEntityParser();
