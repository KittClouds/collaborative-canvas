/**
 * Unified Relationship Extraction Engine
 * 
 * High-performance relationship extraction using:
 * - Wink NLP for linguistic analysis
 * - ResoRank for entity matching
 * - Multiple extraction patterns (SVO, PREP, POSSESSION)
 */

export {
    UnifiedRelationshipEngine,
    getUnifiedRelationshipEngine,
    resetUnifiedRelationshipEngine
} from './UnifiedRelationshipEngine';

export { SVOExtractor } from './SVOExtractor';
export { PrepExtractor } from './PrepExtractor';
export { PossessionExtractor } from './PossessionExtractor';
export { CoOccurrenceExtractor } from './CoOccurrenceExtractor';
