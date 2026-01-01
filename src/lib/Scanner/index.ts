/**
 * Scanner Module - Unified API for Rust WASM Document Scanner
 * 
 * This is the ONLY public scanner API. All scanning is done in Rust/WASM.
 * 
 * Usage:
 *   import { scannerFacade } from '@/lib/scanner';
 *   await scannerFacade.initialize();
 *   scannerFacade.scan(noteId, text);
 */

// Core Facade (main API)
export { scannerFacade } from './scanner-facade';

// Re-export types from bridge
export type {
    ScanResult,
    ExtractedRelation,
    ExtractedTriple,
    ImplicitMention,
    TemporalMention,
    EntityDefinition,
    EntitySpan,
} from './bridge';

// Persistence
export { persistTemporalMentions, clearTemporalMentions } from './temporal-persistence';

// Controller (for scan + persist workflow)
export {
    ScannerController,
    scannerController,
    type PersistenceResult,
    type ScanPersistOptions,
} from './ScannerController';

// Pattern Bridge (for loading relation patterns)
export {
    scannerPatternBridge,
    ScannerPatternBridge,
    loadRelationPatternsForScanner,
    refreshScannerPatterns,
} from './pattern-bridge';

// React Hooks
export {
    useKittCoreScanner,
    useScannerPipeline,
    type ScannerStatus,
    type EntityMatch,
    type SyntaxMatch,
} from './hooks';
