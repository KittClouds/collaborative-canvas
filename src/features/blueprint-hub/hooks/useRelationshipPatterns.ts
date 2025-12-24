import { useState, useEffect, useCallback } from 'react';
import { generateId } from '@/lib/utils/ids';
import type { RelationshipPattern, CreateRelationshipPatternInput } from '../types';

const STORAGE_KEY = 'blueprint_relationship_patterns';

function loadPatterns(): RelationshipPattern[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function savePatterns(patterns: RelationshipPattern[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
    } catch (e) {
        console.error('Failed to save relationship patterns:', e);
    }
}

const DEFAULT_PATTERNS: Omit<RelationshipPattern, 'pattern_id' | 'profile_id' | 'created_at'>[] = [
    { verb_pattern: 'met|knows|knew|befriended', relationship_type: 'KNOWS', inverse_type: 'KNOWN_BY', confidence: 0.7, category: 'social', bidirectional: true, enabled: true },
    { verb_pattern: 'allied with|friends with', relationship_type: 'ALLY_OF', inverse_type: 'ALLY_OF', confidence: 0.75, category: 'social', bidirectional: true, enabled: true },
    { verb_pattern: 'enemy of|fights|opposes', relationship_type: 'ENEMY_OF', inverse_type: 'ENEMY_OF', confidence: 0.75, category: 'social', bidirectional: true, enabled: true },
    { verb_pattern: 'located in|lives in|resides at', relationship_type: 'LOCATED_IN', inverse_type: 'CONTAINS', confidence: 0.8, category: 'spatial', bidirectional: false, enabled: true },
    { verb_pattern: 'owns|possesses|carries', relationship_type: 'OWNS', inverse_type: 'OWNED_BY', confidence: 0.75, category: 'possession', bidirectional: false, enabled: true },
    { verb_pattern: 'member of|belongs to|part of', relationship_type: 'MEMBER_OF', inverse_type: 'HAS_MEMBER', confidence: 0.8, category: 'organizational', bidirectional: false, enabled: true },
    { verb_pattern: 'leads|rules|governs', relationship_type: 'LEADS', inverse_type: 'LED_BY', confidence: 0.8, category: 'organizational', bidirectional: false, enabled: true },
    { verb_pattern: 'created|made|built|forged', relationship_type: 'CREATED', inverse_type: 'CREATED_BY', confidence: 0.75, category: 'creation', bidirectional: false, enabled: true },
    { verb_pattern: 'parent of|father of|mother of', relationship_type: 'PARENT_OF', inverse_type: 'CHILD_OF', confidence: 0.9, category: 'familial', bidirectional: false, enabled: true },
    { verb_pattern: 'married to|spouse of', relationship_type: 'MARRIED_TO', inverse_type: 'MARRIED_TO', confidence: 0.9, category: 'familial', bidirectional: true, enabled: true },
];

export interface UseRelationshipPatternsReturn {
    patterns: RelationshipPattern[];
    isLoading: boolean;
    error: Error | null;
    addPattern: (input: Omit<CreateRelationshipPatternInput, 'profile_id'>) => Promise<void>;
    updatePattern: (pattern_id: string, updates: Partial<CreateRelationshipPatternInput>) => Promise<void>;
    removePattern: (pattern_id: string) => Promise<void>;
    togglePattern: (pattern_id: string) => Promise<void>;
    resetToDefaults: () => Promise<void>;
    refresh: () => void;
}

export function useRelationshipPatterns(profileId?: string): UseRelationshipPatternsReturn {
    const [patterns, setPatterns] = useState<RelationshipPattern[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const loadFromStorage = useCallback(() => {
        setIsLoading(true);
        try {
            let loaded = loadPatterns();
            
            if (loaded.length === 0) {
                loaded = DEFAULT_PATTERNS.map(p => ({
                    ...p,
                    pattern_id: generateId(),
                    profile_id: profileId || 'default',
                    created_at: Date.now(),
                }));
                savePatterns(loaded);
            }

            setPatterns(loaded);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e : new Error(String(e)));
        } finally {
            setIsLoading(false);
        }
    }, [profileId]);

    useEffect(() => {
        loadFromStorage();
    }, [loadFromStorage]);

    const addPattern = useCallback(async (input: Omit<CreateRelationshipPatternInput, 'profile_id'>) => {
        const newPattern: RelationshipPattern = {
            pattern_id: generateId(),
            profile_id: profileId || 'default',
            verb_pattern: input.verb_pattern,
            relationship_type: input.relationship_type,
            inverse_type: input.inverse_type,
            confidence: input.confidence ?? 0.7,
            category: input.category ?? 'custom',
            bidirectional: input.bidirectional ?? false,
            enabled: input.enabled ?? true,
            created_at: Date.now(),
        };

        const updated = [...patterns, newPattern];
        setPatterns(updated);
        savePatterns(updated);
    }, [patterns, profileId]);

    const updatePattern = useCallback(async (pattern_id: string, updates: Partial<CreateRelationshipPatternInput>) => {
        const updated = patterns.map(p => {
            if (p.pattern_id !== pattern_id) return p;
            return {
                ...p,
                ...updates,
            };
        });
        setPatterns(updated);
        savePatterns(updated);
    }, [patterns]);

    const removePattern = useCallback(async (pattern_id: string) => {
        const updated = patterns.filter(p => p.pattern_id !== pattern_id);
        setPatterns(updated);
        savePatterns(updated);
    }, [patterns]);

    const togglePattern = useCallback(async (pattern_id: string) => {
        const updated = patterns.map(p => {
            if (p.pattern_id !== pattern_id) return p;
            return { ...p, enabled: !p.enabled };
        });
        setPatterns(updated);
        savePatterns(updated);
    }, [patterns]);

    const resetToDefaults = useCallback(async () => {
        const defaultPatterns = DEFAULT_PATTERNS.map(p => ({
            ...p,
            pattern_id: generateId(),
            profile_id: profileId || 'default',
            created_at: Date.now(),
        }));
        setPatterns(defaultPatterns);
        savePatterns(defaultPatterns);
    }, [profileId]);

    return {
        patterns,
        isLoading,
        error,
        addPattern,
        updatePattern,
        removePattern,
        togglePattern,
        resetToDefaults,
        refresh: loadFromStorage,
    };
}
