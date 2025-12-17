import { tool } from 'ai';
import { z } from 'zod';

/**
 * Query Intent Types for Knowledge Graph System
 */
export enum QueryIntent {
    // Direct lookups
    ENTITY_LOOKUP = 'entity_lookup',           // "who is X", "what is Y"
    KEYWORD_SEARCH = 'keyword_search',         // "notes about React"

    // Relationship queries
    RELATIONSHIP = 'relationship',              // "how are X and Y related"
    PATH_FINDING = 'path_finding',             // "connection between X and Y"
    NEIGHBORHOOD = 'neighborhood',              // "what's connected to X"

    // Temporal queries
    EVOLUTION = 'evolution',                    // "how has X changed"
    TIMELINE = 'timeline',                      // "history of X"
    SNAPSHOT = 'snapshot',                      // "X at time Y"

    // Semantic/conceptual
    SEMANTIC = 'semantic',                      // "similar to X", "themes about Y"
    CONCEPTUAL = 'conceptual',                  // "explain concept X"

    // Analytical
    COMMUNITY = 'community',                    // "groups of X", "clusters"
    COMPARISON = 'comparison',                  // "compare X and Y"
    AGGREGATION = 'aggregation',               // "all X related to Y"

    // Exploratory
    EXPLORATORY = 'exploratory',               // "tell me about X"
    DISCOVERY = 'discovery',                   // "what's interesting about X"
}

/**
 * Search Strategy Configuration
 */
export interface SearchStrategy {
    intent: QueryIntent;
    modalities: {
        type: 'vector' | 'fts' | 'graph' | 'path' | 'history' | 'community' | 'entity';
        priority: number;
        params?: Record<string, any>;
    }[];
    fusionStrategy: 'weighted' | 'ranked' | 'intersect' | 'union';
    confidence: number;
    reasoning: string;
}

/**
 * Query Classification with Pattern Matching & Heuristics
 */
export class QueryClassifier {
    private patterns = {
        // Entity lookup patterns
        entityLookup: [
            /^(who|what) (?:is|are) (?:the )?(.+?)[\?\.]*$/i,
            /^define (.+?)[\?\.]*$/i,
            /^(get|show|find) (?:me )?(?:the )?(?:entity|character|person|thing) (.+?)[\?\.]*$/i,
        ],

        // Relationship patterns
        relationship: [
            /(?:how|what) (?:is|are) (.+?) (?:related|connected|linked) (?:to|with) (.+?)[\?\.]*$/i,
            /(?:relationship|connection|link) between (.+?) and (.+?)[\?\.]*$/i,
            /(.+?) (?:and|vs|versus) (.+?) relationship[\?\.]*$/i,
        ],

        pathFinding: [
            /path (?:from|between) (.+?) (?:to|and) (.+?)[\?\.]*$/i,
            /(?:how|what) connects (.+?) (?:to|and|with) (.+?)[\?\.]*$/i,
            /shortest (?:path|route|connection) (?:from|between) (.+?) (?:to|and) (.+?)[\?\.]*$/i,
        ],

        neighborhood: [
            /(?:what's|what is) (?:around|near|connected to) (.+?)[\?\.]*$/i,
            /(?:show|find|get) (?:everything|all|things) (?:connected|related|linked) to (.+?)[\?\.]*$/i,
            /(.+?)(?:'s| is) (?:connections|neighbors|network)[\?\.]*$/i,
        ],

        // Temporal patterns
        evolution: [
            /(?:how|what) (?:has|have) (.+?) (?:changed|evolved|developed|progressed)[\?\.]*$/i,
            /(?:evolution|change|development|progression) of (.+?)[\?\.]*$/i,
            /(.+?) over time[\?\.]*$/i,
        ],

        timeline: [
            /(?:history|timeline|chronology) of (.+?)[\?\.]*$/i,
            /(?:show|give|get) (?:me )?(?:the )?(?:complete )?(?:history|timeline) (?:of|for) (.+?)[\?\.]*$/i,
        ],

        snapshot: [
            /(.+?) (?:at|in|during) (.+?)[\?\.]*$/i,
            /(?:how|what) (?:was|were) (.+?) (?:at|in|during) (.+?)[\?\.]*$/i,
        ],

        // Semantic patterns
        semantic: [
            /(?:similar|like|related) (?:to|as) (.+?)[\?\.]*$/i,
            /(?:themes|topics|concepts) (?:in|about|related to) (.+?)[\?\.]*$/i,
            /(?:find|show) (?:notes|entities|things) (?:similar|like|related) to (.+?)[\?\.]*$/i,
        ],

        conceptual: [
            /(?:explain|describe|what is|what are) (?:the concept of )?(.+?)[\?\.]*$/i,
            /(?:meaning|definition) of (.+?)[\?\.]*$/i,
        ],

        // Analytical patterns
        community: [
            /(?:groups|clusters|communities|categories) (?:of|in|within) (.+?)[\?\.]*$/i,
            /(?:find|detect|identify) (?:groups|clusters|communities) (?:in|of|within) (.+?)[\?\.]*$/i,
            /(?:what|which) (?:groups|clusters|categories) (?:contain|include|have) (.+?)[\?\.]*$/i,
        ],

        comparison: [
            /(?:compare|contrast|difference between) (.+?) (?:and|vs|versus|with) (.+?)[\?\.]*$/i,
            /(.+?) (?:vs|versus) (.+?)[\?\.]*$/i,
            /(?:similarities|differences) between (.+?) and (.+?)[\?\.]*$/i,
        ],

        aggregation: [
            /(?:all|every|everything) (?:about|related to|concerning) (.+?)[\?\.]*$/i,
            /(?:list|show|find) (?:all|every) (.+?)[\?\.]*$/i,
        ],

        // Exploratory patterns
        exploratory: [
            /(?:tell me|explain) (?:about|everything about) (.+?)[\?\.]*$/i,
            /(?:what|tell me) (?:can you|should I|do I need to) (?:know|understand) about (.+?)[\?\.]*$/i,
        ],

        discovery: [
            /(?:what's|what is) (?:interesting|notable|important|significant) (?:about|in) (.+?)[\?\.]*$/i,
            /(?:discover|explore|investigate) (.+?)[\?\.]*$/i,
        ],
    };

    /**
     * Extract entities mentioned in query
     */
    extractEntities(query: string): string[] {
        // Match quoted entities
        const quoted = query.match(/"([^"]+)"/g)?.map(q => q.replace(/"/g, '')) || [];

        // Match capitalized words (potential entity names)
        const capitalized = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];

        // Remove common words
        const stopWords = new Set(['The', 'A', 'An', 'This', 'That', 'These', 'Those', 'I', 'You', 'What', 'How', 'Why']);
        const filtered = capitalized.filter(w => !stopWords.has(w));

        return [...new Set([...quoted, ...filtered])];
    }

    /**
     * Detect query complexity
     */
    private analyzeComplexity(query: string): {
        isComplex: boolean;
        hasMultipleEntities: boolean;
        hasTemporalAspect: boolean;
        hasComparison: boolean;
    } {
        const entities = this.extractEntities(query);
        const temporalKeywords = /(?:changed|evolved|history|timeline|over time|at|during|in \d{4})/i;
        const comparisonKeywords = /(?:compare|contrast|vs|versus|difference|similar|like)/i;

        const hasMultipleEntities = entities.length > 1;
        const hasTemporalAspect = temporalKeywords.test(query);
        const hasComparison = comparisonKeywords.test(query);

        const isComplex =
            (hasMultipleEntities && hasTemporalAspect) ||
            (hasComparison && hasTemporalAspect) ||
            (entities.length > 2) ||
            query.split(' ').length > 15;

        return { isComplex, hasMultipleEntities, hasTemporalAspect, hasComparison };
    }

    /**
     * Match query against patterns
     */
    private matchPatterns(query: string): { intent: QueryIntent; matches: RegExpMatchArray | null }[] {
        const results: { intent: QueryIntent; matches: RegExpMatchArray | null }[] = [];

        const intentMapping: Record<string, QueryIntent> = {
            entityLookup: QueryIntent.ENTITY_LOOKUP,
            relationship: QueryIntent.RELATIONSHIP,
            pathFinding: QueryIntent.PATH_FINDING,
            neighborhood: QueryIntent.NEIGHBORHOOD,
            evolution: QueryIntent.EVOLUTION,
            timeline: QueryIntent.TIMELINE,
            snapshot: QueryIntent.SNAPSHOT,
            semantic: QueryIntent.SEMANTIC,
            conceptual: QueryIntent.CONCEPTUAL,
            community: QueryIntent.COMMUNITY,
            comparison: QueryIntent.COMPARISON,
            aggregation: QueryIntent.AGGREGATION,
            exploratory: QueryIntent.EXPLORATORY,
            discovery: QueryIntent.DISCOVERY,
        };

        for (const [intentKey, patterns] of Object.entries(this.patterns)) {
            for (const pattern of patterns) {
                const match = query.match(pattern);
                if (match) {
                    const intent = intentMapping[intentKey];
                    if (intent) {
                        results.push({ intent, matches: match });
                    }
                }
            }
        }

        return results;
    }

    /**
     * Build search strategy based on intent
     */
    private buildStrategy(
        intent: QueryIntent,
        query: string,
        complexity: ReturnType<typeof this.analyzeComplexity>
    ): SearchStrategy {
        const strategies: Record<QueryIntent, Omit<SearchStrategy, 'intent' | 'confidence' | 'reasoning'>> = {
            [QueryIntent.ENTITY_LOOKUP]: {
                modalities: [
                    { type: 'fts', priority: 1, params: { maxResults: 5 } },
                    { type: 'entity', priority: 2 },
                    { type: 'graph', priority: 3, params: { maxHops: 1 } },
                ],
                fusionStrategy: 'ranked',
            },

            [QueryIntent.KEYWORD_SEARCH]: {
                modalities: [
                    { type: 'fts', priority: 1, params: { maxResults: 10 } },
                    { type: 'vector', priority: 2, params: { maxResults: 5 } },
                ],
                fusionStrategy: 'union',
            },

            [QueryIntent.RELATIONSHIP]: {
                modalities: [
                    { type: 'path', priority: 1 },
                    { type: 'graph', priority: 2, params: { maxHops: 2 } },
                    { type: 'vector', priority: 3, params: { enableGraphExpansion: true } },
                ],
                fusionStrategy: 'weighted',
            },

            [QueryIntent.PATH_FINDING]: {
                modalities: [
                    { type: 'path', priority: 1 },
                    { type: 'graph', priority: 2, params: { maxHops: 3 } },
                ],
                fusionStrategy: 'ranked',
            },

            [QueryIntent.NEIGHBORHOOD]: {
                modalities: [
                    { type: 'fts', priority: 1, params: { maxResults: 1 } }, // Find the entity first
                    { type: 'graph', priority: 2, params: { maxHops: 2 } },
                ],
                fusionStrategy: 'ranked',
            },

            [QueryIntent.EVOLUTION]: {
                modalities: [
                    { type: 'history', priority: 1 },
                    { type: 'vector', priority: 2, params: { maxResults: 10 } },
                    { type: 'graph', priority: 3, params: { maxHops: 1 } },
                ],
                fusionStrategy: 'weighted',
            },

            [QueryIntent.TIMELINE]: {
                modalities: [
                    { type: 'history', priority: 1 },
                    { type: 'fts', priority: 2, params: { maxResults: 20 } },
                ],
                fusionStrategy: 'ranked',
            },

            [QueryIntent.SNAPSHOT]: {
                modalities: [
                    { type: 'history', priority: 1 },
                    { type: 'entity', priority: 2 },
                ],
                fusionStrategy: 'ranked',
            },

            [QueryIntent.SEMANTIC]: {
                modalities: [
                    { type: 'vector', priority: 1, params: { maxResults: 15, enableGraphExpansion: true } },
                    { type: 'graph', priority: 2, params: { maxHops: 2 } },
                ],
                fusionStrategy: 'weighted',
            },

            [QueryIntent.CONCEPTUAL]: {
                modalities: [
                    { type: 'vector', priority: 1, params: { maxResults: 10 } },
                    { type: 'fts', priority: 2, params: { maxResults: 5 } },
                    { type: 'entity', priority: 3 },
                ],
                fusionStrategy: 'union',
            },

            [QueryIntent.COMMUNITY]: {
                modalities: [
                    { type: 'community', priority: 1 },
                    { type: 'graph', priority: 2, params: { maxHops: 3 } },
                ],
                fusionStrategy: 'ranked',
            },

            [QueryIntent.COMPARISON]: {
                modalities: [
                    { type: 'entity', priority: 1 }, // Get both entities
                    { type: 'path', priority: 2 },   // Find connections
                    { type: 'vector', priority: 3, params: { maxResults: 10 } },
                    { type: 'graph', priority: 4, params: { maxHops: 2 } },
                ],
                fusionStrategy: 'weighted',
            },

            [QueryIntent.AGGREGATION]: {
                modalities: [
                    { type: 'vector', priority: 1, params: { maxResults: 30 } },
                    { type: 'fts', priority: 2, params: { maxResults: 20 } },
                    { type: 'graph', priority: 3, params: { maxHops: 2 } },
                ],
                fusionStrategy: 'union',
            },

            [QueryIntent.EXPLORATORY]: {
                modalities: [
                    { type: 'vector', priority: 1, params: { maxResults: 15, enableGraphExpansion: true } },
                    { type: 'entity', priority: 2 },
                    { type: 'graph', priority: 3, params: { maxHops: 2 } },
                    { type: 'fts', priority: 4, params: { maxResults: 10 } },
                ],
                fusionStrategy: 'weighted',
            },

            [QueryIntent.DISCOVERY]: {
                modalities: [
                    { type: 'vector', priority: 1, params: { maxResults: 20 } },
                    { type: 'community', priority: 2 },
                    { type: 'graph', priority: 3, params: { maxHops: 3 } },
                ],
                fusionStrategy: 'weighted',
            },
        };

        const baseStrategy = { ...strategies[intent] };

        // Adjust strategy based on complexity
        if (complexity.isComplex) {
            // Add more modalities for complex queries
            if (!baseStrategy.modalities.find(m => m.type === 'vector')) {
                baseStrategy.modalities.push({ type: 'vector', priority: 99, params: { maxResults: 10 } });
            }
            if (!baseStrategy.modalities.find(m => m.type === 'graph')) {
                baseStrategy.modalities.push({ type: 'graph', priority: 99, params: { maxHops: 2 } });
            }
        }

        if (complexity.hasTemporalAspect && !baseStrategy.modalities.find(m => m.type === 'history')) {
            baseStrategy.modalities.unshift({ type: 'history', priority: 0 });
        }

        return {
            ...baseStrategy,
            intent,
            confidence: 0.85, // Will be calculated properly
            reasoning: `Detected ${intent} query with ${complexity.isComplex ? 'complex' : 'simple'} structure`,
        };
    }

    /**
     * Classify query and return search strategy
     */
    classify(query: string): SearchStrategy {
        const normalized = query.trim();
        const complexity = this.analyzeComplexity(normalized);
        const matches = this.matchPatterns(normalized);

        if (matches.length === 0) {
            // Default to exploratory search
            return this.buildStrategy(QueryIntent.EXPLORATORY, normalized, complexity);
        }

        // Use highest confidence match
        const primaryMatch = matches[0];
        const confidence = matches.length === 1 ? 0.95 : 0.75; // Lower confidence if multiple intents detected

        const strategy = this.buildStrategy(primaryMatch.intent, normalized, complexity);
        strategy.confidence = confidence;
        strategy.reasoning = `Matched pattern for ${primaryMatch.intent}. ${matches.length > 1 ? `Also detected: ${matches.slice(1).map(m => m.intent).join(', ')}` : ''}`;

        return strategy;
    }
}

/**
 * Mastra Tool: Query Classification
 */
export const queryClassifierTool = tool({
    description: 'Analyze a query to determine search intent and strategy. Returns optimal modalities and fusion approach.',
    parameters: z.object({
        query: z.string().describe('The user query to classify'),
    }),
    execute: async ({ query }) => {
        try {
            const classifier = new QueryClassifier();
            const strategy = classifier.classify(query);

            return {
                success: true,
                strategy,
                entities: classifier.extractEntities(query),
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },
} as any);
