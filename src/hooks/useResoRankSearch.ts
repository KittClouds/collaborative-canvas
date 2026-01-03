import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ResoRankScorer, createProductionScorer, ProximityStrategy, RESORANK_PRODUCTION_CONFIG } from '@/lib/resorank';
import type { Note } from '@/types/noteTypes';

export interface ResoRankResult {
    docId: string;
    score: number;
    normalizedScore?: number;
}

/**
 * Hook for ResoRank-powered search
 * Uses the pure TypeScript implementation for reliable, fast lexical search
 */
export function useResoRankSearch(notes: Note[]) {
    const scorerRef = useRef<ResoRankScorer<string> | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isIndexing, setIsIndexing] = useState(false);
    const lastIndexedCountRef = useRef(0);

    // Initialize scorer with corpus statistics
    const corpusStats = useMemo(() => {
        const totalDocs = notes.length;
        let totalLength = 0;

        const sampleSize = Math.min(notes.length, 100);
        const step = Math.max(1, Math.floor(notes.length / sampleSize));

        for (let i = 0; i < notes.length; i += step) {
            const note = notes[i];
            const len = (note.title.length + note.content.length) / 5;
            totalLength += len;
        }

        const avgLength = totalDocs > 0 ? (totalLength / Math.ceil(notes.length / step)) : 100;

        return {
            totalDocuments: totalDocs,
            averageFieldLengths: new Map([
                [0, avgLength * 0.2],
                [1, avgLength * 0.8],
            ]),
            averageDocumentLength: avgLength,
        };
    }, [notes.length]);

    // Initialize or update the scorer
    useEffect(() => {
        if (notes.length === 0) {
            setIsReady(false);
            return;
        }

        // Skip if already indexed this exact set
        if (lastIndexedCountRef.current === notes.length && scorerRef.current) {
            return;
        }

        setIsIndexing(true);

        scorerRef.current = createProductionScorer(corpusStats, {
            strategy: ProximityStrategy.Pairwise,
        });

        // First pass: Calculate global document frequency
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

        // Second pass: Index documents
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

        scorerRef.current.warmIdfCache();
        lastIndexedCountRef.current = notes.length;
        setIsIndexing(false);
        setIsReady(true);
    }, [notes, corpusStats]);

    const search = useCallback((query: string, limit = 20): ResoRankResult[] => {
        if (!scorerRef.current || !query.trim()) return [];
        if (notes.length === 0) return [];

        const queryTokens = tokenize(query);
        if (queryTokens.length === 0) return [];

        return scorerRef.current.search(queryTokens, limit);
    }, [notes.length]);

    return { search, isReady, isIndexing };
}

/**
 * Hook for debounced ResoRank search with results state
 */
export function useResoRankSearchWithDebounce(
    notes: Note[],
    query: string,
    options: { debounceMs?: number; minLength?: number; limit?: number } = {}
) {
    const { debounceMs = 150, minLength = 2, limit = 20 } = options;
    const { search, isReady, isIndexing } = useResoRankSearch(notes);
    const [results, setResults] = useState<ResoRankResult[]>([]);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (!isReady || query.trim().length < minLength) {
            setResults([]);
            return;
        }

        debounceRef.current = setTimeout(() => {
            const searchResults = search(query, limit);
            setResults(searchResults);
        }, debounceMs);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, isReady, search, debounceMs, minLength, limit]);

    return { results, isReady, isIndexing, search };
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
