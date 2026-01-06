/**
 * useMediaAggregator Hook
 * Extracts images from note content for the Media Gallery.
 */
import { useMemo } from 'react';
import { useJotaiNotes } from '@/hooks/useJotaiNotes';
import { getCategoryByKind } from '../types/wikiTypes';
import { getDisplayName } from '@/lib/utils/titleParser';

export interface MediaItem {
    id: string;
    src: string;
    alt?: string;
    noteId: string;
    noteTitle: string;
    entityKind?: string;
    color?: string;
}

export interface MediaData {
    items: MediaItem[];
    totalCount: number;
    byKind: Map<string, MediaItem[]>;
    isLoaded: boolean;
}

function extractImagesFromContent(content: string): Array<{ src: string; alt?: string }> {
    const images: Array<{ src: string; alt?: string }> = [];

    if (!content) return images;

    // Parse HTML img tags
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
        images.push({
            src: match[1],
            alt: match[2] || undefined
        });
    }

    // Parse markdown images: ![alt](src)
    const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((match = mdRegex.exec(content)) !== null) {
        images.push({
            src: match[2],
            alt: match[1] || undefined
        });
    }

    // Filter out duplicates and invalid URLs
    const seen = new Set<string>();
    return images.filter(img => {
        if (seen.has(img.src)) return false;
        // Skip data URLs that are too small (likely icons)
        if (img.src.startsWith('data:') && img.src.length < 200) return false;
        // Skip common placeholder/icon patterns
        if (img.src.includes('placeholder') || img.src.includes('icon')) return false;
        seen.add(img.src);
        return true;
    });
}

export function useMediaAggregator(): MediaData {
    const { state: { notes } } = useJotaiNotes();

    const data = useMemo(() => {
        const items: MediaItem[] = [];
        const byKind = new Map<string, MediaItem[]>();

        notes.forEach(note => {
            const images = extractImagesFromContent(note.content);
            const category = note.entityKind ? getCategoryByKind(note.entityKind) : null;

            images.forEach((img, index) => {
                const item: MediaItem = {
                    id: `${note.id}_img_${index}`,
                    src: img.src,
                    alt: img.alt,
                    noteId: note.id,
                    noteTitle: getDisplayName(note.title) || 'Untitled',
                    entityKind: note.entityKind || undefined,
                    color: category?.color
                };

                items.push(item);

                // Group by kind
                const kind = note.entityKind || 'OTHER';
                if (!byKind.has(kind)) {
                    byKind.set(kind, []);
                }
                byKind.get(kind)!.push(item);
            });
        });

        return {
            items,
            totalCount: items.length,
            byKind,
            isLoaded: true
        };
    }, [notes]);

    return data;
}

export default useMediaAggregator;
