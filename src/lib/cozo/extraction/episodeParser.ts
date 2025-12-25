import type { JSONContent } from '@tiptap/react';
import type { CozoEpisode, ExtractionEpisode } from '../types';
import { generateId } from '@/lib/utils/ids';

export interface EpisodeParseOptions {
    noteId: string;
    groupId: string;
    scopeType: 'note' | 'folder' | 'vault';
    granularity: 'block' | 'paragraph' | 'sentence';
}

/**
 * Parse Tiptap document into episodes
 * Episode = extraction unit (paragraph, block, or sentence)
 */
export function parseDocumentIntoEpisodes(
    content: JSONContent,
    options: EpisodeParseOptions
): ExtractionEpisode[] {
    const episodes: ExtractionEpisode[] = [];

    const validAt = new Date();

    // Walk document tree
    const walkNode = (
        node: JSONContent,
        blockIndex: number = 0,
        paragraphIndex: number = 0
    ) => {
        // Extract text content from node
        const text = extractTextFromNode(node);

        if (!text.trim()) return;

        // Create episode based on granularity
        if (options.granularity === 'block' && isBlockNode(node)) {
            episodes.push({
                id: generateId(),
                noteId: options.noteId,
                createdAt: new Date(),
                validAt,
                contentText: text,
                contentJson: node,
                blockId: node.attrs?.id || generateBlockId(node),
                groupId: options.groupId,
                scopeType: options.scopeType,
                extractionMethod: 'regex',
                paragraphIndex,
            });
        } else if (options.granularity === 'paragraph') {
            // Split by paragraph breaks
            const paragraphs = splitIntoParagraphs(text);
            paragraphs.forEach((para, idx) => {
                if (!para.trim()) return;
                episodes.push({
                    id: generateId(),
                    noteId: options.noteId,
                    createdAt: new Date(),
                    validAt,
                    contentText: para,
                    contentJson: undefined,
                    blockId: undefined,
                    groupId: options.groupId,
                    scopeType: options.scopeType,
                    extractionMethod: 'regex',
                    paragraphIndex: paragraphIndex + idx,
                });
            });
        } else if (options.granularity === 'sentence') {
            // Split by sentences (for co-occurrence)
            const sentences = splitIntoSentences(text);
            sentences.forEach((sent, idx) => {
                if (!sent.trim()) return;
                episodes.push({
                    id: generateId(),
                    noteId: options.noteId,
                    createdAt: new Date(),
                    validAt,
                    contentText: sent,
                    contentJson: undefined,
                    blockId: undefined,
                    groupId: options.groupId,
                    scopeType: options.scopeType,
                    extractionMethod: 'regex',
                    sentenceIndex: idx,
                    paragraphIndex,
                });
            });
        }

        // Recurse into child nodes
        if (node.content) {
            node.content.forEach((child, idx) => {
                walkNode(child, blockIndex + idx, paragraphIndex);
            });
        }
    };

    if (content.content) {
        content.content.forEach((node, idx) => walkNode(node, idx, idx));
    }

    return episodes;
}

/**
 * Extract plain text from Tiptap node
 */
function extractTextFromNode(node: JSONContent): string {
    if (node.type === 'text') return node.text || '';

    if (node.content) {
        return node.content.map(extractTextFromNode).join('');
    }

    return '';
}

/**
 * Check if node is a block-level element
 */
function isBlockNode(node: JSONContent): boolean {
    const blockTypes = ['paragraph', 'heading', 'codeBlock', 'blockquote', 'listItem'];
    return blockTypes.includes(node.type || '');
}

/**
 * Split text into paragraphs
 */
function splitIntoParagraphs(text: string): string[] {
    return text.split(/\n\n+/).filter(Boolean);
}

/**
 * Split text into sentences (simple heuristic)
 */
function splitIntoSentences(text: string): string[] {
    // Split on .!? followed by space/newline
    return text
        .split(/([.!?]+)\s+/)
        .reduce<string[]>((acc, part, idx, arr) => {
            if (idx % 2 === 0) {
                const sentence = part + (arr[idx + 1] || '');
                if (sentence.trim()) acc.push(sentence.trim());
            }
            return acc;
        }, []);
}

/**
 * Generate stable block ID from node content
 */
function generateBlockId(node: JSONContent): string {
    const text = extractTextFromNode(node);
    return `block-${hashString(text).toString(36)}`;
}

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}
