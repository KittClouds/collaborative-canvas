/**
 * RelationshipRules - Relationship Type Inference Engine
 * 
 * Maps verb lemmas and patterns to semantic relationship types.
 * Uses entity kind constraints for disambiguation.
 */

import type { EntityKind } from '@/lib/entities/entityTypes';

// ==================== RELATIONSHIP TYPE DEFINITIONS ====================

export interface RelationshipTypeRule {
    type: string;               // Semantic type ("WORKS_AT", "CREATED_BY", etc.)
    inverseType?: string;       // Inverse relationship type
    confidence: number;         // Base confidence (0-1)
    bidirectional: boolean;     // If true, A→B implies B→A
}

export interface VerbPatternRule {
    lemmas: string[];           // Verb lemmas that trigger this rule
    relationshipType: string;
    inverseType?: string;
    confidence: number;
    sourceKinds?: EntityKind[]; // Valid source entity kinds
    targetKinds?: EntityKind[]; // Valid target entity kinds
}

export interface PrepPatternRule {
    prep: string;               // Preposition ("at", "in", "with")
    relationshipType: string;
    inverseType?: string;
    confidence: number;
    sourceKinds?: EntityKind[];
    targetKinds?: EntityKind[];
}

// ==================== VERB PATTERN RULES ====================

/**
 * Verb lemma → relationship type mapping
 * Ordered by specificity (more specific rules first)
 */
export const VERB_PATTERN_RULES: VerbPatternRule[] = [
    // Employment / Work relationships
    {
        lemmas: ['work', 'employ', 'hire', 'join'],
        relationshipType: 'WORKS_AT',
        inverseType: 'EMPLOYS',
        confidence: 0.85,
        sourceKinds: ['CHARACTER'],
        targetKinds: ['FACTION', 'LOCATION']
    },
    {
        lemmas: ['found', 'establish', 'create', 'start'],
        relationshipType: 'FOUNDED',
        inverseType: 'FOUNDED_BY',
        confidence: 0.9,
        sourceKinds: ['CHARACTER'],
        targetKinds: ['FACTION']
    },
    {
        lemmas: ['lead', 'manage', 'direct', 'head', 'run'],
        relationshipType: 'LEADS',
        inverseType: 'LED_BY',
        confidence: 0.85,
        sourceKinds: ['CHARACTER'],
        targetKinds: ['FACTION', 'EVENT']
    },

    // Creation / Authorship
    {
        lemmas: ['write', 'author', 'pen', 'compose'],
        relationshipType: 'AUTHORED',
        inverseType: 'AUTHORED_BY',
        confidence: 0.9,
        sourceKinds: ['CHARACTER'],
        targetKinds: ['ITEM', 'CONCEPT']
    },
    {
        lemmas: ['create', 'make', 'build', 'develop', 'design'],
        relationshipType: 'CREATED',
        inverseType: 'CREATED_BY',
        confidence: 0.8,
    },
    {
        lemmas: ['invent', 'discover', 'pioneer'],
        relationshipType: 'INVENTED',
        inverseType: 'INVENTED_BY',
        confidence: 0.9,
        sourceKinds: ['CHARACTER'],
        targetKinds: ['CONCEPT']
    },

    // Participation / Involvement
    {
        lemmas: ['attend', 'participate', 'join'],
        relationshipType: 'PARTICIPATED_IN',
        inverseType: 'HAD_PARTICIPANT',
        confidence: 0.8,
        targetKinds: ['EVENT']
    },
    {
        lemmas: ['speak', 'present', 'lecture', 'talk'],
        relationshipType: 'SPOKE_AT',
        inverseType: 'HAD_SPEAKER',
        confidence: 0.85,
        sourceKinds: ['CHARACTER'],
        targetKinds: ['EVENT', 'LOCATION']
    },

    // Location / Containment
    {
        lemmas: ['live', 'reside', 'dwell', 'stay'],
        relationshipType: 'LIVES_IN',
        inverseType: 'HOME_TO',
        confidence: 0.85,
        sourceKinds: ['CHARACTER'],
        targetKinds: ['LOCATION']
    },
    {
        lemmas: ['locate', 'situate', 'base'],
        relationshipType: 'LOCATED_IN',
        inverseType: 'CONTAINS',
        confidence: 0.8,
        targetKinds: ['LOCATION']
    },

    // Ownership / Possession
    {
        lemmas: ['own', 'possess', 'have', 'hold'],
        relationshipType: 'OWNS',
        inverseType: 'OWNED_BY',
        confidence: 0.75,
    },
    {
        lemmas: ['acquire', 'buy', 'purchase'],
        relationshipType: 'ACQUIRED',
        inverseType: 'ACQUIRED_BY',
        confidence: 0.85,
        sourceKinds: ['CHARACTER', 'FACTION'],
        targetKinds: ['FACTION']
    },

    // Social / Interpersonal
    {
        lemmas: ['meet', 'encounter', 'know'],
        relationshipType: 'KNOWS',
        inverseType: 'KNOWS',
        confidence: 0.6,
        sourceKinds: ['CHARACTER'],
        targetKinds: ['CHARACTER']
    },
    {
        lemmas: ['marry', 'wed'],
        relationshipType: 'MARRIED_TO',
        inverseType: 'MARRIED_TO',
        confidence: 0.95,
        sourceKinds: ['CHARACTER'],
        targetKinds: ['CHARACTER']
    },
    {
        lemmas: ['collaborate', 'partner', 'cooperate'],
        relationshipType: 'COLLABORATES_WITH',
        inverseType: 'COLLABORATES_WITH',
        confidence: 0.75,
    },

    // Influence / Causation
    {
        lemmas: ['influence', 'affect', 'impact', 'shape'],
        relationshipType: 'INFLUENCES',
        inverseType: 'INFLUENCED_BY',
        confidence: 0.7,
    },
    {
        lemmas: ['inspire', 'motivate'],
        relationshipType: 'INSPIRED',
        inverseType: 'INSPIRED_BY',
        confidence: 0.75,
    },
    {
        lemmas: ['cause', 'trigger', 'result'],
        relationshipType: 'CAUSED',
        inverseType: 'CAUSED_BY',
        confidence: 0.8,
    },

    // Association (fallback)
    {
        lemmas: ['use', 'utilize', 'apply'],
        relationshipType: 'USES',
        inverseType: 'USED_BY',
        confidence: 0.6,
    },
    {
        lemmas: ['mention', 'reference', 'cite'],
        relationshipType: 'REFERENCES',
        inverseType: 'REFERENCED_BY',
        confidence: 0.65,
    },
    {
        lemmas: ['relate', 'connect', 'link', 'associate'],
        relationshipType: 'RELATED_TO',
        inverseType: 'RELATED_TO',
        confidence: 0.5,
    }
];

// ==================== PREPOSITION PATTERN RULES ====================

export const PREP_PATTERN_RULES: PrepPatternRule[] = [
    {
        prep: 'at',
        relationshipType: 'LOCATED_AT',
        inverseType: 'LOCATION_OF',
        confidence: 0.7,
        targetKinds: ['LOCATION', 'FACTION', 'EVENT']
    },
    {
        prep: 'in',
        relationshipType: 'LOCATED_IN',
        inverseType: 'CONTAINS',
        confidence: 0.7,
        targetKinds: ['LOCATION', 'FACTION', 'EVENT']
    },
    {
        prep: 'from',
        relationshipType: 'FROM',
        inverseType: 'ORIGIN_OF',
        confidence: 0.65,
        targetKinds: ['LOCATION']
    },
    {
        prep: 'with',
        relationshipType: 'ASSOCIATED_WITH',
        inverseType: 'ASSOCIATED_WITH',
        confidence: 0.5,
    },
    {
        prep: 'for',
        relationshipType: 'FOR',
        inverseType: 'HAS',
        confidence: 0.5,
    },
    {
        prep: 'by',
        relationshipType: 'BY',
        inverseType: 'CREATED',
        confidence: 0.6,
    },
    {
        prep: 'about',
        relationshipType: 'ABOUT',
        inverseType: 'SUBJECT_OF',
        confidence: 0.6,
        targetKinds: ['CONCEPT', 'EVENT', 'CHARACTER']
    }
];

// ==================== POSSESSIVE RULES ====================

export interface PossessiveTypeRule {
    ownerKind: EntityKind;
    ownedKind?: EntityKind;
    relationshipType: string;
    inverseType: string;
    confidence: number;
}

export const POSSESSIVE_RULES: PossessiveTypeRule[] = [
    {
        ownerKind: 'CHARACTER',
        ownedKind: 'ITEM',
        relationshipType: 'AUTHORED',
        inverseType: 'AUTHORED_BY',
        confidence: 0.8
    },
    {
        ownerKind: 'CHARACTER',
        ownedKind: 'CONCEPT',
        relationshipType: 'CONCEIVED',
        inverseType: 'CONCEIVED_BY',
        confidence: 0.75
    },
    {
        ownerKind: 'FACTION',
        ownedKind: 'ITEM',
        relationshipType: 'PRODUCES',
        inverseType: 'PRODUCED_BY',
        confidence: 0.85
    },
    // Generic fallback
    {
        ownerKind: 'CHARACTER',
        relationshipType: 'OWNS',
        inverseType: 'OWNED_BY',
        confidence: 0.6
    },
    {
        ownerKind: 'FACTION',
        relationshipType: 'HAS',
        inverseType: 'BELONGS_TO',
        confidence: 0.6
    }
];

// ==================== INFERENCE FUNCTIONS ====================

/**
 * Infer relationship type from extraction pattern
 * 
 * @param pattern - Extraction pattern ('SVO', 'PREP', 'POSSESSION')
 * @param verbLemma - Verb lemma (for SVO patterns)
 * @param prep - Preposition (for PREP patterns)
 * @param sourceKind - Source entity kind
 * @param targetKind - Target entity kind
 * @returns Relationship type rule or null if no match
 */
export function inferRelationshipType(
    pattern: 'SVO' | 'PREP' | 'POSSESSION',
    verbLemma?: string,
    prep?: string,
    sourceKind?: EntityKind,
    targetKind?: EntityKind
): RelationshipTypeRule | null {
    switch (pattern) {
        case 'SVO':
            return inferFromVerb(verbLemma!, sourceKind, targetKind);
        case 'PREP':
            return inferFromPrep(prep!, sourceKind, targetKind);
        case 'POSSESSION':
            return inferFromPossessive(sourceKind, targetKind);
        default:
            return null;
    }
}

function inferFromVerb(
    lemma: string,
    sourceKind?: EntityKind,
    targetKind?: EntityKind
): RelationshipTypeRule | null {
    const normalizedLemma = lemma.toLowerCase();

    for (const rule of VERB_PATTERN_RULES) {
        if (!rule.lemmas.includes(normalizedLemma)) continue;

        // Check entity kind constraints
        if (rule.sourceKinds && sourceKind && !rule.sourceKinds.includes(sourceKind)) {
            continue;
        }
        if (rule.targetKinds && targetKind && !rule.targetKinds.includes(targetKind)) {
            continue;
        }

        return {
            type: rule.relationshipType,
            inverseType: rule.inverseType,
            confidence: rule.confidence,
            bidirectional: rule.relationshipType === rule.inverseType
        };
    }

    // Fallback: generic verb relationship
    return {
        type: 'RELATED_TO',
        inverseType: 'RELATED_TO',
        confidence: 0.4,
        bidirectional: true
    };
}

function inferFromPrep(
    prep: string,
    sourceKind?: EntityKind,
    targetKind?: EntityKind
): RelationshipTypeRule | null {
    const normalizedPrep = prep.toLowerCase();

    for (const rule of PREP_PATTERN_RULES) {
        if (rule.prep !== normalizedPrep) continue;

        // Check entity kind constraints
        if (rule.sourceKinds && sourceKind && !rule.sourceKinds.includes(sourceKind)) {
            continue;
        }
        if (rule.targetKinds && targetKind && !rule.targetKinds.includes(targetKind)) {
            continue;
        }

        return {
            type: rule.relationshipType,
            inverseType: rule.inverseType,
            confidence: rule.confidence,
            bidirectional: rule.relationshipType === rule.inverseType
        };
    }

    return null;
}

function inferFromPossessive(
    ownerKind?: EntityKind,
    ownedKind?: EntityKind
): RelationshipTypeRule | null {
    for (const rule of POSSESSIVE_RULES) {
        if (ownerKind && rule.ownerKind !== ownerKind) continue;
        if (rule.ownedKind && ownedKind && rule.ownedKind !== ownedKind) continue;

        return {
            type: rule.relationshipType,
            inverseType: rule.inverseType,
            confidence: rule.confidence,
            bidirectional: false
        };
    }

    // Fallback
    return {
        type: 'HAS',
        inverseType: 'BELONGS_TO',
        confidence: 0.5,
        bidirectional: false
    };
}

// ==================== EXPORTS ====================

export const RELATIONSHIP_TYPE_RULES = {
    verb: VERB_PATTERN_RULES,
    prep: PREP_PATTERN_RULES,
    possessive: POSSESSIVE_RULES
};
