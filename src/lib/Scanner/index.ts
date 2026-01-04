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

// Low-level bridges (for advanced use / A/B testing)
export {
    conductorBridge,
    ConductorBridge,
} from './bridge';

// Persistence
export { persistTemporalMentions, clearTemporalMentions } from './temporal-persistence';

// Pattern Bridge (for loading relation patterns)
export {
    scannerPatternBridge,
    ScannerPatternBridge,
    loadRelationPatternsForScanner,
    refreshScannerPatterns,
} from './pattern-bridge';

// ===========================================================================
// NEW: Rust-First Facades (Phase 2 Migration)
// ===========================================================================

// Unified Scanner - Pattern detection + decoration spans
export {
    UnifiedScannerFacade,
    unifiedScannerFacade,
    toPatternRanges,
    type RefKind,
    type StylingHint,
    type DecorationSpan,
    type UnifiedScanResult,
    type UnifiedScanStats,
    type HighlightMode,
    type FocusModeConfig,
    type ModeStyles,
} from './unified-facade';

// Constraints - Validation + uniqueness
export {
    ConstraintsFacade,
    constraintsFacade,
    type ConstraintResult,
    type RefInput,
    type RefPosition,
    type RefPayload,
} from './constraints-facade';

// Projections - Timelines, graphs, character sheets
export {
    ProjectionsFacade,
    projectionsFacade,
    type TimelineEvent,
    type CharacterSheet,
    type CharacterRelationship,
    type NoteAppearance,
    type CharacterStats,
    type RelationshipGraph,
    type LinkGraph,
    type ProjectionRef,
    type ProjectionPayload,
} from './projections-facade';

/**
 * Initialize all Rust-first scanner facades
 * 
 * Call this once at app startup to load WASM modules.
 */
export async function initializeRustFacades(): Promise<{
    scanner: boolean;
    constraints: boolean;
    projections: boolean;
}> {
    const results = await Promise.allSettled([
        import('./unified-facade').then(m => m.unifiedScannerFacade.initialize()),
        import('./constraints-facade').then(m => m.constraintsFacade.initialize()),
        import('./projections-facade').then(m => m.projectionsFacade.initialize()),
    ]);

    return {
        scanner: results[0].status === 'fulfilled',
        constraints: results[1].status === 'fulfilled',
        projections: results[2].status === 'fulfilled',
    };
}

