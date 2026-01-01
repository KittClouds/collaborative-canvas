/**
 * Scanner Bridge Module
 * 
 * Connects the KittCore WASM scanner with external pattern sources.
 */

export {
    ScannerPatternBridge,
    scannerPatternBridge,
    loadRelationPatternsForScanner,
    refreshScannerPatterns,
    type ScannerPattern,
    type PatternKind,
    type PatternLoadResult,
} from './ScannerPatternBridge';

// NOTE: RustScanner is NOT exported here to avoid auto-loading WASM.
// When WASM is built and ready, import directly:
// import { RustScanner } from './RustScanner';


