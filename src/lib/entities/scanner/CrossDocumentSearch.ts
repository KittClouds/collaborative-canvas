/**
 * CrossDocumentSearch - Global entity-centric search
 * 
 * Provides:
 * - Alias-aware entity search (Searching "AAPL" finds "Apple Inc")
 * - Mention context extraction
 * - Entity-to-Note mapping
 */

import { entityRegistry, RegisteredEntity } from '../entity-registry';
import type { Note } from '@/contexts/NotesContext';
import { JSONContent } from '@tiptap/react';

export interface EntitySearchResult {
    note: Note;
    entity: RegisteredEntity | null;
    appearanceCount: number;
    contexts: string[];
    positions: number[];
}

export class CrossDocumentSearch {
    private notes: Note[];

    constructor(notes: Note[] = []) {
        this.notes = notes;
    }

    updateNotes(notes: Note[]): void {
        this.notes = notes;
    }

    /**
     * Search for an entity (by name or ID) across all notes
     */
    searchByEntity(query: string): EntitySearchResult[] {
        // 1. Resolve query to canonical entity
        const entity = entityRegistry.findEntity(query) || entityRegistry.getEntityById(query);
        if (!entity) return [];

        const results: EntitySearchResult[] = [];
        const patterns = [entity.label, ...(entity.aliases || [])];

        for (const note of this.notes) {
            const plainText = this.extractPlainText(note);
            const positions: number[] = [];

            for (const pattern of patterns) {
                const regex = new RegExp(`\\b${this.escapeRegex(pattern)}\\b`, 'gi');
                let match;
                while ((match = regex.exec(plainText)) !== null) {
                    positions.push(match.index);
                }
            }

            if (positions.length > 0) {
                results.push({
                    note,
                    entity,
                    appearanceCount: positions.length,
                    positions: positions.sort((a, b) => a - b),
                    contexts: this.extractContexts(plainText, positions)
                });
            }
        }

        return results.sort((a, b) => b.appearanceCount - a.appearanceCount);
    }

    /**
     * Free text search with proximity context
     */
    searchByText(query: string): EntitySearchResult[] {
        if (!query || query.length < 2) return [];

        const results: EntitySearchResult[] = [];
        const regex = new RegExp(this.escapeRegex(query), 'gi');

        for (const note of this.notes) {
            const plainText = this.extractPlainText(note);
            const positions: number[] = [];

            let match;
            while ((match = regex.exec(plainText)) !== null) {
                positions.push(match.index);
            }

            if (positions.length > 0) {
                results.push({
                    note,
                    entity: null,
                    appearanceCount: positions.length,
                    positions: positions.sort((a, b) => a - b),
                    contexts: this.extractContexts(plainText, positions)
                });
            }
        }

        return results;
    }

    private extractPlainText(note: Note): string {
        try {
            const content = JSON.parse(note.content) as JSONContent;
            return this.walkContent(content);
        } catch {
            return '';
        }
    }

    private walkContent(node: JSONContent): string {
        if (node.type === 'text') return node.text || '';
        if (!node.content) return '';
        return node.content.map(child => this.walkContent(child)).join(' ');
    }

    private extractContexts(text: string, positions: number[]): string[] {
        return positions.slice(0, 5).map(pos => { // Max 5 context snippets
            const start = Math.max(0, pos - 50);
            const end = Math.min(text.length, pos + 50);
            return `...${text.slice(start, end).replace(/\n/g, ' ')}...`;
        });
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
