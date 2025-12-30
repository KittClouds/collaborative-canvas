import { useEffect, useMemo, useRef } from 'react';
import { ResoRankScorer, createProductionScorer, ProximityStrategy, RESORANK_PRODUCTION_CONFIG } from '@/lib/resorank';
import type { Note } from '@/types/noteTypes';

export function useResoRankSearch(notes: Note[]) {
    const scorerRef = useRef<ResoRankScorer<string> | null>(null);

    // Initialize scorer with corpus statistics
    const corpusStats = useMemo(() => {
        const totalDocs = notes.length;
        let totalLength = 0;

        // We can do a lightweight pass just for stats if needed, 
        // but the main effect will handle indexing.
        // For the stats memo, we'll try to be efficient.
        const sampleSize = Math.min(notes.length, 100);
        const step = Math.max(1, Math.floor(notes.length / sampleSize));

        for (let i = 0; i < notes.length; i += step) {
            const note = notes[i];
            // Quick approximation of length (words)
            const len = (note.title.length + note.content.length) / 5;
            totalLength += len;
        }

        const avgLength = totalDocs > 0 ? (totalLength / Math.ceil(notes.length / step)) : 100;

        return {
            totalDocuments: totalDocs,
            averageFieldLengths: new Map([
                [0, avgLength * 0.2], // Title field (shorter)
                [1, avgLength * 0.8], // Content field (longer)
            ]),
            averageDocumentLength: avgLength,
        };
    }, [notes.length]); // Only recompute when count changes significantly? 
    // Ideally we should process content changes too, but that's expensive for just stats.
    // The effect below will handle full re-indexing.

    // Initialize or update the scorer
    useEffect(() => {
        // If we have no notes, we can still initialize but it won't be very useful until we index
        if (notes.length === 0) return;

        scorerRef.current = createProductionScorer(corpusStats, {
            strategy: ProximityStrategy.Pairwise, // Fast and accurate
        });

        // 1. First pass: Calculate global document frequency for each term
        const globalTermCounts = new Map<string, number>();
        const noteTokensMap = new Map<string, { titleTokens: string[], contentTokens: string[] }>();

        notes.forEach(note => {
            const titleTokens = tokenize(note.title);
            const contentTokens = tokenize(note.content);
            const uniqueTerms = new Set([...titleTokens, ...contentTokens]);

            uniqueTerms.forEach(term => {
                globalTermCounts.set(term, (globalTermCounts.get(term) || 0) + 1);
            });

            noteTokensMap.set(note.id, { titleTokens, contentTokens });
        });

        // 2. Second pass: Index documents with correct corpus frequencies
        notes.forEach(note => {
            const tokensInfo = noteTokensMap.get(note.id);
            if (!tokensInfo) return;

            const { titleTokens, contentTokens } = tokensInfo;
            const allTokens = [...titleTokens, ...contentTokens];

            const tokenMetadata = buildTokenMetadata(
                titleTokens,
                contentTokens,
                RESORANK_PRODUCTION_CONFIG.maxSegments,
                globalTermCounts
            );

            const docMetadata = {
                fieldLengths: new Map([
                    [0, titleTokens.length],
                    [1, contentTokens.length],
                ]),
                totalTokenCount: allTokens.length,
            };

            scorerRef.current!.indexDocument(note.id, docMetadata, tokenMetadata);
        });

        // Warm the IDF cache for better performance
        scorerRef.current.warmIdfCache();
    }, [notes, corpusStats]);

    const search = (query: string, limit = 20) => {
        if (!scorerRef.current || !query.trim()) return [];

        if (notes.length === 0) return [];

        const queryTokens = tokenize(query);
        // return scorerRef.current.search(queryTokens, limit);
        // Note: The search method returns { docId, score }.
        // We simply return that result.
        return scorerRef.current.search(queryTokens, limit);
    };

    return { search };
}

// Simple tokenizer: lowercase, strip punctuation, split on whitespace
function tokenize(text: string): string[] {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with space to avoid merging words
        .split(/\s+/)
        .filter(t => t.length > 0);
}

// Build token metadata for ResoRank
function buildTokenMetadata(
    titleTokens: string[],
    contentTokens: string[],
    maxSegments: number,
    globalTermCounts: Map<string, number>
) {
    const tokenMap = new Map();
    const allTokens = [...titleTokens, ...contentTokens];

    allTokens.forEach((token, position) => {
        const fieldId = position < titleTokens.length ? 0 : 1;
        const fieldLength = fieldId === 0 ? titleTokens.length : contentTokens.length;

        if (!tokenMap.has(token)) {
            tokenMap.set(token, {
                fieldOccurrences: new Map(),
                segmentMask: 0,
                corpusDocFrequency: globalTermCounts.get(token) || 1,
            });
        }

        const meta = tokenMap.get(token);

        // Update field occurrences
        if (!meta.fieldOccurrences.has(fieldId)) {
            meta.fieldOccurrences.set(fieldId, { tf: 0, fieldLength });
        }
        meta.fieldOccurrences.get(fieldId).tf++;

        // Calculate segment mask
        const segmentIndex = Math.floor((position / allTokens.length) * maxSegments);
        // Ensure segmentIndex is within 0 to 31 (bitwise limits)
        // maxSegments is normally 16, so safe.
        if (segmentIndex < 32) {
            meta.segmentMask |= (1 << segmentIndex);
        }
    });

    return tokenMap;
}
