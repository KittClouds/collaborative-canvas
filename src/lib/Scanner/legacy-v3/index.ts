// Legacy scanner-v3 index - Forwarding to new Rust scanner implementation
// This file is deprecated. Please import from '@/lib/scanner' instead.

// Core Hooks (now forwarding to lib/scanner/hooks)
export {
    useKittCoreScanner,
    useScannerPipeline,
    type ScanResult,
    type EntityMatch,
    type SyntaxMatch,
    type TemporalMention,
    type ExtractedRelation,
    type ScannerStatus,
} from '@/lib/scanner';

// Controller (forwarding to lib/scanner)
export {
    scannerController,
    ScannerController,
    type PersistenceResult,
    type ScanPersistOptions,
} from '@/lib/scanner';

// Pattern Bridge (forwarding to lib/scanner)
export {
    scannerPatternBridge,
    ScannerPatternBridge,
    loadRelationPatternsForScanner,
    refreshScannerPatterns,
} from '@/lib/scanner';

