/**
 * AllProfanityEntityMatcher - High-performance entity matching using AllProfanity
 * 
 * Leverages AllProfanity's Trie+Aho-Corasick engine for:
 * - Leet-speak normalization (Fr0d0 → Frodo)
 * - Result caching (123x speedup on repeated scans)
 * - Whitelisting (suppress false positives)
 * - Position tracking for accurate highlighting
 * 
 * @module scanner-v3/extractors
 */

import { AllProfanity } from 'allprofanity';
import type { RegisteredEntity } from '@/lib/cozo/graph/adapters/EntityRegistryAdapter';

// ==================== TYPE DEFINITIONS ====================

export interface EntityMatch {
    entity: RegisteredEntity;
    position: number;
    length: number;
    matchedText: string;
    matchType: 'exact' | 'alias' | 'leet';
    confidence: number;
}

export interface AllProfanityConfig {
    enableCaching: boolean;
    cacheSize: number;
    enableLeetSpeak: boolean;
}

// ==================== CONSTANTS ====================

/**
 * Default words to whitelist - common English words that often
 * match entity type names but aren't actual entity references
 */
const DEFAULT_WHITELIST = [
    'character',
    'characters',
    'location',
    'locations',
    'item',
    'items',
    'event',
    'events',
    'concept',
    'concepts',
    'faction',
    'factions',
    'creature',
    'creatures',
    'object',
    'objects',
];

const DEFAULT_CONFIG: AllProfanityConfig = {
    enableCaching: true,
    cacheSize: 1000,
    enableLeetSpeak: true,
};

// ==================== MAIN CLASS ====================

/**
 * Entity matcher using AllProfanity's optimized pattern matching engine
 */
export class AllProfanityEntityMatcher {
    private filter: AllProfanity;
    private entityIndex: Map<string, RegisteredEntity> = new Map();
    private aliasIndex: Map<string, RegisteredEntity> = new Map();
    private initialized = false;
    private config: AllProfanityConfig;

    constructor(config: Partial<AllProfanityConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        this.filter = new AllProfanity({
            algorithm: {
                matching: 'aho-corasick', // Best for large texts (documents)
            },
            profanityDetection: {
                enableLeetSpeak: this.config.enableLeetSpeak,
                caseSensitive: false,
            },
            performance: {
                enableCaching: this.config.enableCaching,
                cacheSize: this.config.cacheSize,
            },
        });

        // Clear default profanity dictionary - we only want entity matching
        this.filter.clearList();

        // Add default whitelist
        this.filter.addToWhitelist(DEFAULT_WHITELIST);
    }

    /**
     * Initialize matcher with registered entities
     * Should be called once during scanner startup
     */
    initialize(entities: RegisteredEntity[], config?: Partial<AllProfanityConfig>): void {
        if (config) {
            this.config = { ...this.config, ...config };
        }

        // Clear previous state
        this.filter.clearList();
        this.entityIndex.clear();
        this.aliasIndex.clear();

        // Re-add whitelist after clear
        this.filter.addToWhitelist(DEFAULT_WHITELIST);

        const patterns: string[] = [];

        for (const entity of entities) {
            // Skip very short labels (high false positive rate)
            if (entity.label.length < 3) continue;

            // Index by lowercase label for fast lookup
            const lowerLabel = entity.label.toLowerCase();
            this.entityIndex.set(lowerLabel, entity);
            patterns.push(entity.label);

            // Index aliases
            if (entity.aliases && entity.aliases.length > 0) {
                for (const alias of entity.aliases) {
                    if (alias.length < 3) continue;
                    const lowerAlias = alias.toLowerCase();
                    this.aliasIndex.set(lowerAlias, entity);
                    patterns.push(alias);
                }
            }
        }

        // Load all patterns into AllProfanity's dictionary
        if (patterns.length > 0) {
            this.filter.add(patterns);
        }

        this.initialized = true;
        console.log(`[AllProfanityEntityMatcher] Initialized with ${patterns.length} patterns from ${entities.length} entities`);
    }

    /**
     * Check if matcher is ready for use
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Find entity mentions in text with positions
     * 
     * @param text - Text to search for entity mentions
     * @returns Array of entity matches with positions and confidence
     */
    findMentions(text: string): EntityMatch[] {
        if (!this.initialized) {
            console.warn('[AllProfanityEntityMatcher] Not initialized, returning empty results');
            return [];
        }

        const matches: EntityMatch[] = [];

        // Use AllProfanity's detect() for positions
        const result = this.filter.detect(text);

        if (!result.hasProfanity || !result.positions) {
            return matches;
        }

        const processed = new Set<string>(); // Avoid duplicate matches at same position

        for (const pos of result.positions) {
            const posKey = `${pos.start}-${pos.end}`;
            if (processed.has(posKey)) continue;
            processed.add(posKey);

            const matchedText = pos.word;
            const lowerMatch = matchedText.toLowerCase();

            // Determine match type and find entity
            let entity: RegisteredEntity | undefined;
            let matchType: 'exact' | 'alias' | 'leet' = 'exact';

            // Check exact label match first
            entity = this.entityIndex.get(lowerMatch);

            if (!entity) {
                // Check alias match
                entity = this.aliasIndex.get(lowerMatch);
                if (entity) {
                    matchType = 'alias';
                }
            }

            // If still no match, it might be a leet-speak normalized match
            // AllProfanity's leet-speak detection means the original text
            // might not directly match our index
            if (!entity) {
                // Try to find by iterating (fallback for leet-speak matches)
                for (const [label, ent] of this.entityIndex) {
                    if (this.isLeetMatch(lowerMatch, label)) {
                        entity = ent;
                        matchType = 'leet';
                        break;
                    }
                }

                if (!entity) {
                    for (const [alias, ent] of this.aliasIndex) {
                        if (this.isLeetMatch(lowerMatch, alias)) {
                            entity = ent;
                            matchType = 'leet';
                            break;
                        }
                    }
                }
            }

            if (entity) {
                // Map match type to confidence
                const confidence = matchType === 'exact' ? 1.0
                    : matchType === 'alias' ? 0.9
                        : 0.7; // leet

                matches.push({
                    entity,
                    position: pos.start,
                    length: pos.end - pos.start,
                    matchedText,
                    matchType,
                    confidence,
                });
            }
        }

        // Sort by position
        matches.sort((a, b) => a.position - b.position);

        return matches;
    }

    /**
     * Simple leet-speak comparison
     * Checks if two strings are similar when leet characters are normalized
     */
    private isLeetMatch(input: string, target: string): boolean {
        const normalizedInput = this.normalizeLeet(input);
        const normalizedTarget = this.normalizeLeet(target);
        return normalizedInput === normalizedTarget;
    }

    /**
     * Normalize leet-speak characters to standard letters
     */
    private normalizeLeet(text: string): string {
        const leetMap: Record<string, string> = {
            '0': 'o',
            '1': 'i',
            '3': 'e',
            '4': 'a',
            '5': 's',
            '7': 't',
            '@': 'a',
            '$': 's',
            '#': 'h',
        };

        return text
            .toLowerCase()
            .split('')
            .map(char => leetMap[char] || char)
            .join('');
    }

    /**
     * Add words to whitelist (exclude from detection)
     */
    addToWhitelist(words: string[]): void {
        this.filter.addToWhitelist(words);
    }

    /**
     * Remove words from whitelist
     */
    removeFromWhitelist(words: string[]): void {
        this.filter.removeFromWhitelist(words);
    }

    /**
     * Invalidate internal cache
     * Call when entities are added/removed/modified
     */
    invalidateCache(): void {
        // AllProfanity doesn't expose direct cache invalidation,
        // but re-initializing with same entities will rebuild
        console.log('[AllProfanityEntityMatcher] Cache invalidation requested');
    }

    /**
     * Get current configuration
     */
    getConfig(): AllProfanityConfig {
        return { ...this.config };
    }

    /**
     * Quick check if text contains any entity mentions
     * Faster than findMentions() when you just need boolean
     */
    containsEntities(text: string): boolean {
        if (!this.initialized) return false;
        return this.filter.check(text);
    }
}

// ==================== SINGLETON ====================

export const allProfanityEntityMatcher = new AllProfanityEntityMatcher();
