/**
 * useScannerPipeline - Complete scan-to-persist React hook
 * 
 * Integrates KittCore WASM scanning with CozoDB persistence.
 * Provides a single hook for the complete document processing pipeline.
 * 
 * @module scanner-v3/hooks
 */

import { useCallback, useState, useEffect } from 'react';
import { useKittCoreScanner, type ScanResult } from './useKittCoreScanner';
import { scannerController, type PersistenceResult, type ScanPersistOptions } from '../controller';
import type { CozoEntity, CozoRelationship } from '@/lib/cozo/graph/UnifiedRegistry';
import type { RegisteredEntity } from '@/lib/cozo/graph/adapters/EntityRegistryAdapter';

// ============================================================================
// Types
// ============================================================================

export interface UseScannerPipelineOptions {
    /** Auto-initialize scanner on mount (default: true) */
    autoInit?: boolean;
    /** Auto-hydrate entities from registry on init (default: true) */
    autoHydrateEntities?: boolean;
    /** Auto-hydrate relation patterns from Blueprint Hub (default: true) */
    autoHydrateRelations?: boolean;
    /** Default options for persistence */
    defaultPersistOptions?: Partial<ScanPersistOptions>;
}

export interface UseScannerPipelineResult {
    // Scanner state
    isReady: boolean;
    isInitializing: boolean;
    isScanning: boolean;
    isPersisting: boolean;
    error: string | null;

    // Hydration state
    entitiesHydrated: boolean;
    relationsHydrated: boolean;

    // Core operations
    /** Scan text and get results (no persistence) */
    scan: (text: string) => Promise<ScanResult>;
    /** Scan text and persist results to CozoDB */
    scanAndPersist: (text: string, noteId: string, options?: Partial<ScanPersistOptions>) => Promise<ScanAndPersistResult>;
    /** Just persist existing scan results */
    persist: (scanResult: ScanResult, options: ScanPersistOptions) => Promise<PersistenceResult>;

    // Hydration
    /** Hydrate scanner with entities from registry */
    hydrateEntities: (entities?: RegisteredEntity[]) => Promise<void>;
    /** Refresh entities from registry and re-hydrate */
    refreshEntities: () => Promise<void>;

    // Statistics
    lastScanStats: ScanStats | null;
    lastPersistStats: PersistStats | null;
}

export interface ScanAndPersistResult {
    scanResult: ScanResult;
    persistResult: PersistenceResult;
    stats: {
        totalTimeMs: number;
        scanTimeMs: number;
        persistTimeMs: number;
    };
}

export interface ScanStats {
    textLength: number;
    entityCount: number;
    relationCount: number;
    temporalCount: number;
    syntaxCount: number;
    totalTimeMs: number;
}

export interface PersistStats {
    entitiesCreated: number;
    entitiesMatched: number;
    relationshipsCreated: number;
    timeMs: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useScannerPipeline(
    options: UseScannerPipelineOptions = {}
): UseScannerPipelineResult {
    const {
        autoInit = true,
        autoHydrateEntities = true,
        autoHydrateRelations = true,
        defaultPersistOptions = {},
    } = options;

    // Scanner hook
    const scanner = useKittCoreScanner({
        autoInit,
        autoHydrateRelations,
        config: {
            enable_reflex: true,
            enable_syntax: true,
            enable_temporal: true,
            enable_relations: true,
            case_insensitive: true,
        },
    });

    // Local state
    const [isScanning, setIsScanning] = useState(false);
    const [isPersisting, setIsPersisting] = useState(false);
    const [lastScanStats, setLastScanStats] = useState<ScanStats | null>(null);
    const [lastPersistStats, setLastPersistStats] = useState<PersistStats | null>(null);

    // ==========================================================================
    // Auto-hydrate entities when scanner is ready
    // ==========================================================================

    useEffect(() => {
        if (scanner.isReady && autoHydrateEntities && !scanner.entitiesHydrated) {
            refreshEntities().catch(console.error);
        }
    }, [scanner.isReady, autoHydrateEntities, scanner.entitiesHydrated]);

    // ==========================================================================
    // Operations
    // ==========================================================================

    /**
     * Scan text without persistence
     */
    const scan = useCallback(async (text: string): Promise<ScanResult> => {
        setIsScanning(true);
        try {
            const result = await scanner.scan(text);

            setLastScanStats({
                textLength: text.length,
                entityCount: result.entities.length,
                relationCount: result.relations?.length || 0,
                temporalCount: result.temporal.length,
                syntaxCount: result.syntax.length,
                totalTimeMs: result.stats.total_time_ms,
            });

            return result;
        } finally {
            setIsScanning(false);
        }
    }, [scanner]);

    /**
     * Persist scan results to CozoDB
     */
    const persist = useCallback(async (
        scanResult: ScanResult,
        options: ScanPersistOptions
    ): Promise<PersistenceResult> => {
        setIsPersisting(true);
        try {
            const result = await scannerController.persistScanResult(scanResult, options);

            setLastPersistStats({
                entitiesCreated: result.stats.entitiesCreated,
                entitiesMatched: result.stats.entitiesMatched,
                relationshipsCreated: result.stats.relationshipsCreated,
                timeMs: result.stats.persistTimeMs,
            });

            return result;
        } finally {
            setIsPersisting(false);
        }
    }, []);

    /**
     * Scan and persist in one operation
     */
    const scanAndPersist = useCallback(async (
        text: string,
        noteId: string,
        options?: Partial<ScanPersistOptions>
    ): Promise<ScanAndPersistResult> => {
        const start = performance.now();

        // Scan
        const scanStart = performance.now();
        const scanResult = await scan(text);
        const scanTimeMs = performance.now() - scanStart;

        // Persist
        const persistStart = performance.now();
        const persistOptions: ScanPersistOptions = {
            noteId,
            ...defaultPersistOptions,
            ...options,
        };
        const persistResult = await persist(scanResult, persistOptions);
        const persistTimeMs = performance.now() - persistStart;

        const totalTimeMs = performance.now() - start;

        return {
            scanResult,
            persistResult,
            stats: {
                totalTimeMs,
                scanTimeMs,
                persistTimeMs,
            },
        };
    }, [scan, persist, defaultPersistOptions]);

    /**
     * Hydrate scanner with entities
     */
    const hydrateEntities = useCallback(async (entities?: RegisteredEntity[]) => {
        const entitiesToHydrate = entities ?? await scannerController.getEntitiesForHydration();
        await scanner.hydrateEntities(entitiesToHydrate);
    }, [scanner]);

    /**
     * Refresh entities from registry and re-hydrate
     */
    const refreshEntities = useCallback(async () => {
        scannerController.clearCache();
        const entities = await scannerController.getEntitiesForHydration();
        await scanner.hydrateEntities(entities);
        console.log(`[useScannerPipeline] Hydrated ${entities.length} entities`);
    }, [scanner]);

    // ==========================================================================
    // Return
    // ==========================================================================

    return {
        // Scanner state
        isReady: scanner.isReady,
        isInitializing: scanner.isInitializing,
        isScanning,
        isPersisting,
        error: scanner.error,

        // Hydration state
        entitiesHydrated: scanner.entitiesHydrated,
        relationsHydrated: scanner.relationsHydrated,

        // Operations
        scan,
        scanAndPersist,
        persist,
        hydrateEntities,
        refreshEntities,

        // Statistics
        lastScanStats,
        lastPersistStats,
    };
}
