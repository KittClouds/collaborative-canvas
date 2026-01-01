// Core orchestration (legacy)
export { scannerEventBus } from './core/ScannerEventBus';
export { scannerOrchestrator, ScannerOrchestrator } from './core/Orchestrator';
export { ChangeDetector } from './core/ChangeDetector';
export type { PatternMatchEvent, ScannerConfig } from './types';
export { patternExtractor, tripleExtractor, implicitEntityMatcher, type ExtractedTriple, type ImplicitMatch } from './extractors';
export { PatternExtractor, TripleExtractor, ImplicitEntityMatcher } from './extractors';

// KittCore WASM Scanner (Entity System 5.0)
export {
    useKittCoreScanner,
    useScannerPipeline,
    type ScanResult,
    type EntityMatch,
    type SyntaxMatch,
    type TemporalMention,
    type ExtractedRelation,
    type ScannerStatus,
    type ScanAndPersistResult,
} from './hooks';

// Controller and Persistence
export {
    scannerController,
    ScannerController,
    type PersistenceResult,
    type ScanPersistOptions,
} from './controller';

// Pattern Bridge
export {
    scannerPatternBridge,
    ScannerPatternBridge,
    loadRelationPatternsForScanner,
    refreshScannerPatterns,
} from './bridge';
