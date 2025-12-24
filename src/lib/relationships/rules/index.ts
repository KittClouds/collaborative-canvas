/**
 * Relationship extraction rules
 */

export {
    inferRelationshipType,
    VERB_PATTERN_RULES,
    PREP_PATTERN_RULES,
    POSSESSIVE_RULES,
    RELATIONSHIP_TYPE_RULES
} from './RelationshipRules';

export type {
    RelationshipTypeRule,
    VerbPatternRule,
    PrepPatternRule,
    PossessiveTypeRule
} from './RelationshipRules';
