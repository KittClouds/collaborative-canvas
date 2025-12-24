/**
 * Verb Pattern Matcher - Infer relationships from text patterns
 * 
 * Matches verb phrases between entity mentions to infer semantic relationships.
 * E.g., "Jon Snow met Arya Stark" -> KNOWS relationship
 */

import { RelationshipSource } from '../types';

export interface VerbPattern {
    id: string;
    regex: RegExp;
    relationshipType: string;
    inverseType?: string;
    confidence: number;
    category: string;
    bidirectional: boolean;
}

export interface EntitySpan {
    label: string;
    start: number;
    end: number;
    kind?: string;
}

export interface ExtractedRelationship {
    sourceLabel: string;
    targetLabel: string;
    type: string;
    inverseType?: string;
    confidence: number;
    source: RelationshipSource;
    context: string;
    verbMatch?: string;
    bidirectional: boolean;
}

const DEFAULT_VERB_PATTERNS: VerbPattern[] = [
    {
        id: 'knows_met',
        regex: /\b(met|knows|knew|befriended|encountered|recognized)\b/i,
        relationshipType: 'KNOWS',
        inverseType: 'KNOWN_BY',
        confidence: 0.7,
        category: 'social',
        bidirectional: true,
    },
    {
        id: 'allied_with',
        regex: /\b(allied with|allies with|friends with|partnered with|sided with)\b/i,
        relationshipType: 'ALLY_OF',
        inverseType: 'ALLY_OF',
        confidence: 0.75,
        category: 'social',
        bidirectional: true,
    },
    {
        id: 'enemy_of',
        regex: /\b(enemy of|enemies with|fights|fought|opposes|opposed|battles|battled|hates|hated)\b/i,
        relationshipType: 'ENEMY_OF',
        inverseType: 'ENEMY_OF',
        confidence: 0.75,
        category: 'social',
        bidirectional: true,
    },
    {
        id: 'located_in',
        regex: /\b(located in|lives in|resides at|resides in|dwells in|stays at|found in|situated in)\b/i,
        relationshipType: 'LOCATED_IN',
        inverseType: 'CONTAINS',
        confidence: 0.8,
        category: 'spatial',
        bidirectional: false,
    },
    {
        id: 'traveled_to',
        regex: /\b(traveled to|went to|journeyed to|arrived at|reached|visited)\b/i,
        relationshipType: 'TRAVELED_TO',
        inverseType: 'VISITED_BY',
        confidence: 0.65,
        category: 'spatial',
        bidirectional: false,
    },
    {
        id: 'owns',
        regex: /\b(owns|owned|possesses|possessed|carries|carried|holds|held|wields|wielded)\b/i,
        relationshipType: 'OWNS',
        inverseType: 'OWNED_BY',
        confidence: 0.75,
        category: 'possession',
        bidirectional: false,
    },
    {
        id: 'member_of',
        regex: /\b(member of|belongs to|part of|joined|serves|served)\b/i,
        relationshipType: 'MEMBER_OF',
        inverseType: 'HAS_MEMBER',
        confidence: 0.8,
        category: 'organizational',
        bidirectional: false,
    },
    {
        id: 'leads',
        regex: /\b(leads|led|rules|ruled|governs|governed|commands|commanded|controls|controlled)\b/i,
        relationshipType: 'LEADS',
        inverseType: 'LED_BY',
        confidence: 0.8,
        category: 'organizational',
        bidirectional: false,
    },
    {
        id: 'created',
        regex: /\b(created|made|built|forged|crafted|constructed|designed)\b/i,
        relationshipType: 'CREATED',
        inverseType: 'CREATED_BY',
        confidence: 0.75,
        category: 'creation',
        bidirectional: false,
    },
    {
        id: 'parent_of',
        regex: /\b(parent of|father of|mother of|raised|bore)\b/i,
        relationshipType: 'PARENT_OF',
        inverseType: 'CHILD_OF',
        confidence: 0.9,
        category: 'familial',
        bidirectional: false,
    },
    {
        id: 'child_of',
        regex: /\b(child of|son of|daughter of|born to|offspring of)\b/i,
        relationshipType: 'CHILD_OF',
        inverseType: 'PARENT_OF',
        confidence: 0.9,
        category: 'familial',
        bidirectional: false,
    },
    {
        id: 'sibling_of',
        regex: /\b(sibling of|brother of|sister of)\b/i,
        relationshipType: 'SIBLING_OF',
        inverseType: 'SIBLING_OF',
        confidence: 0.9,
        category: 'familial',
        bidirectional: true,
    },
    {
        id: 'married_to',
        regex: /\b(married to|wed|spouse of|husband of|wife of)\b/i,
        relationshipType: 'MARRIED_TO',
        inverseType: 'MARRIED_TO',
        confidence: 0.9,
        category: 'familial',
        bidirectional: true,
    },
    {
        id: 'mentions',
        regex: /\b(mentions|mentioned|refers to|referenced|spoke of|discussed)\b/i,
        relationshipType: 'MENTIONS',
        inverseType: 'MENTIONED_BY',
        confidence: 0.5,
        category: 'reference',
        bidirectional: false,
    },
    {
        id: 'participates_in',
        regex: /\b(participates in|participated in|took part in|attended|witnessed)\b/i,
        relationshipType: 'PARTICIPATES_IN',
        inverseType: 'HAS_PARTICIPANT',
        confidence: 0.7,
        category: 'event',
        bidirectional: false,
    },
];

let customPatterns: VerbPattern[] = [];
let patternsLoaded = false;

const STORAGE_KEY = 'blueprint_relationship_patterns';

interface StoredPattern {
    pattern_id: string;
    verb_pattern: string;
    relationship_type: string;
    inverse_type?: string;
    confidence: number;
    category: string;
    bidirectional: boolean;
    enabled: boolean;
}

function loadPatternsFromStorage(): VerbPattern[] {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return [];
    }
    
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        
        const parsed: StoredPattern[] = JSON.parse(stored);
        return parsed
            .filter(p => p.enabled)
            .map(p => ({
                id: p.pattern_id,
                regex: new RegExp(`\\b(${p.verb_pattern})\\b`, 'i'),
                relationshipType: p.relationship_type,
                inverseType: p.inverse_type,
                confidence: p.confidence,
                category: p.category,
                bidirectional: p.bidirectional,
            }));
    } catch {
        return [];
    }
}

export function refreshPatternsFromStorage(): void {
    customPatterns = loadPatternsFromStorage();
    patternsLoaded = true;
}

export function setCustomPatterns(patterns: VerbPattern[]): void {
    customPatterns = patterns;
    patternsLoaded = true;
}

export function getActivePatterns(): VerbPattern[] {
    if (!patternsLoaded) {
        customPatterns = loadPatternsFromStorage();
        patternsLoaded = true;
    }
    
    if (customPatterns.length > 0) {
        return customPatterns;
    }
    
    return DEFAULT_VERB_PATTERNS;
}

export function matchVerbPatterns(
    text: string,
    entities: EntitySpan[]
): ExtractedRelationship[] {
    if (entities.length < 2) return [];

    const relationships: ExtractedRelationship[] = [];
    const patterns = getActivePatterns();
    const sortedEntities = [...entities].sort((a, b) => a.start - b.start);

    for (let i = 0; i < sortedEntities.length - 1; i++) {
        const entity1 = sortedEntities[i];

        for (let j = i + 1; j < sortedEntities.length; j++) {
            const entity2 = sortedEntities[j];

            const gapStart = entity1.end;
            const gapEnd = entity2.start;

            if (gapEnd - gapStart > 200) continue;

            const textBetween = text.slice(gapStart, gapEnd);

            for (const pattern of patterns) {
                const match = textBetween.match(pattern.regex);
                if (match) {
                    const contextStart = Math.max(0, entity1.start - 20);
                    const contextEnd = Math.min(text.length, entity2.end + 20);

                    relationships.push({
                        sourceLabel: entity1.label,
                        targetLabel: entity2.label,
                        type: pattern.relationshipType,
                        inverseType: pattern.inverseType,
                        confidence: pattern.confidence,
                        source: RelationshipSource.NER_EXTRACTION,
                        context: text.slice(contextStart, contextEnd),
                        verbMatch: match[0],
                        bidirectional: pattern.bidirectional,
                    });

                    break;
                }
            }
        }
    }

    return relationships;
}

export function findPatternById(id: string): VerbPattern | undefined {
    return getActivePatterns().find(p => p.id === id);
}

export function getPatternCategories(): string[] {
    const categories = new Set<string>();
    for (const pattern of getActivePatterns()) {
        categories.add(pattern.category);
    }
    return Array.from(categories).sort();
}
