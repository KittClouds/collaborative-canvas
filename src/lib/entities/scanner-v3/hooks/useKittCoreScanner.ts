/**
 * useKittCoreScanner - React hook for KittCore WASM scanner
 * 
 * Provides a Promise-based API for interacting with the scanner worker.
 * Handles initialization, hydration, and scanning operations.
 * 
 * @module scanner-v3/hooks
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RegisteredEntity } from '@/lib/cozo/graph/adapters/EntityRegistryAdapter';
import type { CalendarDictionary } from '@/lib/time';
import type {
    ScannerWorkerMessage,
    ScannerWorkerResponse,
    ScanResult,
    EntityMatch,
    SyntaxMatch,
    TemporalMention,
    ScannerStatus,
    ExtractedRelation,
    RelationPatternInput,
} from '../workers/ScannerWorker';
import { loadRelationPatternsForScanner } from '../bridge';

// Re-export types for convenience
export type { ScanResult, EntityMatch, SyntaxMatch, TemporalMention, ScannerStatus, ExtractedRelation };

export interface UseKittCoreScannerOptions {
    /** Auto-initialize on mount (default: true) */
    autoInit?: boolean;
    /** Auto-hydrate relation patterns from Blueprint Hub on init (default: true) */
    autoHydrateRelations?: boolean;
    /** Scanner config to pass to WASM */
    config?: {
        enable_reflex?: boolean;
        enable_syntax?: boolean;
        enable_temporal?: boolean;
        enable_relations?: boolean;
        case_insensitive?: boolean;
    };
}

export interface UseKittCoreScannerResult {
    /** Whether the scanner is ready */
    isReady: boolean;
    /** Whether the scanner is currently initializing */
    isInitializing: boolean;
    /** Whether entities have been hydrated */
    entitiesHydrated: boolean;
    /** Whether calendar has been hydrated */
    calendarHydrated: boolean;
    /** Whether relation patterns have been hydrated */
    relationsHydrated: boolean;
    /** Any error that occurred */
    error: string | null;

    /** Initialize the scanner (called automatically if autoInit=true) */
    initialize: () => Promise<void>;
    /** Hydrate with entity data */
    hydrateEntities: (entities: RegisteredEntity[]) => Promise<void>;
    /** Hydrate with calendar data */
    hydrateCalendar: (calendar: CalendarDictionary) => Promise<void>;
    /** Hydrate with relation patterns from Blueprint Hub */
    hydrateRelations: (patterns?: RelationPatternInput[]) => Promise<void>;

    /** Full scan (entities + syntax + temporal + relations) */
    scan: (text: string) => Promise<ScanResult>;
    /** Scan for entity mentions only */
    scanEntities: (text: string) => Promise<EntityMatch[]>;
    /** Scan for syntax patterns only */
    scanSyntax: (text: string) => Promise<SyntaxMatch[]>;
    /** Scan for temporal mentions only */
    scanTemporal: (text: string) => Promise<TemporalMention[]>;

    /** Check if text contains any entities (fast) */
    containsEntities: (text: string) => Promise<boolean>;
    /** Get scanner status */
    getStatus: () => Promise<ScannerStatus>;
}

/**
 * Generate unique request IDs
 */
let requestIdCounter = 0;
function generateRequestId(): string {
    return `req_${Date.now()}_${++requestIdCounter}`;
}

/**
 * React hook for KittCore WASM scanner
 */
export function useKittCoreScanner(options: UseKittCoreScannerOptions = {}): UseKittCoreScannerResult {
    const { autoInit = true, autoHydrateRelations = true, config } = options;

    const workerRef = useRef<Worker | null>(null);
    const pendingRequests = useRef<Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>>(new Map());

    const [isReady, setIsReady] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [entitiesHydrated, setEntitiesHydrated] = useState(false);
    const [calendarHydrated, setCalendarHydrated] = useState(false);
    const [relationsHydrated, setRelationsHydrated] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Send message to worker and wait for response
     */
    const sendMessage = useCallback(<T>(message: Omit<ScannerWorkerMessage, 'requestId'>): Promise<T> => {
        return new Promise((resolve, reject) => {
            if (!workerRef.current) {
                reject(new Error('Worker not initialized'));
                return;
            }

            const requestId = generateRequestId();
            pendingRequests.current.set(requestId, {
                resolve: resolve as (value: unknown) => void,
                reject
            });

            workerRef.current.postMessage({ ...message, requestId });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (pendingRequests.current.has(requestId)) {
                    pendingRequests.current.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }, []);

    /**
     * Handle worker messages
     */
    const handleWorkerMessage = useCallback((event: MessageEvent<ScannerWorkerResponse>) => {
        const { type, payload, requestId } = event.data;

        // Handle request-response pattern
        if (requestId && pendingRequests.current.has(requestId)) {
            const { resolve, reject } = pendingRequests.current.get(requestId)!;
            pendingRequests.current.delete(requestId);

            if (type === 'ERROR') {
                reject(new Error((payload as { error: string }).error));
            } else {
                resolve(payload);
            }
            return;
        }

        // Handle state updates
        switch (type) {
            case 'READY':
                setIsReady(true);
                setIsInitializing(false);
                break;
            case 'ERROR':
                setError((payload as { error: string }).error);
                setIsInitializing(false);
                break;
        }
    }, []);

    /**
     * Initialize the worker
     */
    const initialize = useCallback(async () => {
        if (workerRef.current || isInitializing) {
            return;
        }

        setIsInitializing(true);
        setError(null);

        try {
            // Create worker
            workerRef.current = new Worker(
                new URL('../workers/ScannerWorker.ts', import.meta.url),
                { type: 'module' }
            );

            workerRef.current.onmessage = handleWorkerMessage;
            workerRef.current.onerror = (e) => {
                setError(`Worker error: ${e.message}`);
                setIsInitializing(false);
            };

            // Send init message
            await sendMessage({ type: 'INIT', payload: { config } });

            setIsReady(true);
            setIsInitializing(false);
            console.log('[useKittCoreScanner] Initialized');
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(errorMsg);
            setIsInitializing(false);
            throw err;
        }
    }, [config, handleWorkerMessage, isInitializing, sendMessage]);

    /**
     * Hydrate with entities
     */
    const hydrateEntities = useCallback(async (entities: RegisteredEntity[]) => {
        await sendMessage({ type: 'HYDRATE_ENTITIES', payload: entities });
        setEntitiesHydrated(true);
    }, [sendMessage]);

    /**
     * Hydrate with calendar
     */
    const hydrateCalendar = useCallback(async (calendar: CalendarDictionary) => {
        await sendMessage({ type: 'HYDRATE_CALENDAR', payload: calendar });
        setCalendarHydrated(true);
    }, [sendMessage]);

    /**
     * Hydrate with relation patterns from Blueprint Hub
     * If no patterns provided, loads from Blueprint Hub storage
     */
    const hydrateRelations = useCallback(async (patterns?: RelationPatternInput[]) => {
        const patternsToUse = patterns ?? loadRelationPatternsForScanner();
        await sendMessage({ type: 'HYDRATE_RELATIONS', payload: patternsToUse });
        setRelationsHydrated(true);
        console.log(`[useKittCoreScanner] Hydrated ${patternsToUse.length} relation patterns`);
    }, [sendMessage]);

    /**
     * Full scan
     */
    const scan = useCallback(async (text: string): Promise<ScanResult> => {
        const result = await sendMessage<ScanResult>({ type: 'SCAN', payload: { text } });
        return result;
    }, [sendMessage]);

    /**
     * Scan entities only
     */
    const scanEntities = useCallback(async (text: string): Promise<EntityMatch[]> => {
        const result = await sendMessage<{ entities: EntityMatch[] }>({ type: 'SCAN_REFLEX', payload: { text } });
        return result.entities;
    }, [sendMessage]);

    /**
     * Scan syntax only
     */
    const scanSyntax = useCallback(async (text: string): Promise<SyntaxMatch[]> => {
        const result = await sendMessage<{ syntax: SyntaxMatch[] }>({ type: 'SCAN_SYNTAX', payload: { text } });
        return result.syntax;
    }, [sendMessage]);

    /**
     * Scan temporal only
     */
    const scanTemporal = useCallback(async (text: string): Promise<TemporalMention[]> => {
        const result = await sendMessage<{ mentions: TemporalMention[] }>({ type: 'SCAN_TEMPORAL', payload: { text } });
        return result.mentions;
    }, [sendMessage]);

    /**
     * Quick entity check
     */
    const containsEntities = useCallback(async (text: string): Promise<boolean> => {
        // For now, use scanEntities and check length
        // TODO: Implement dedicated containsEntities in worker
        const entities = await scanEntities(text);
        return entities.length > 0;
    }, [scanEntities]);

    /**
     * Get scanner status
     */
    const getStatus = useCallback(async (): Promise<ScannerStatus> => {
        const result = await sendMessage<ScannerStatus>({ type: 'GET_STATUS' });
        return result;
    }, [sendMessage]);

    /**
     * Auto-initialize on mount
     */
    useEffect(() => {
        if (autoInit) {
            initialize()
                .then(() => {
                    // Auto-hydrate relation patterns from Blueprint Hub
                    if (autoHydrateRelations) {
                        return hydrateRelations();
                    }
                })
                .catch(console.error);
        }

        return () => {
            // Cleanup worker on unmount
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, [autoInit, autoHydrateRelations, initialize, hydrateRelations]);

    return {
        isReady,
        isInitializing,
        entitiesHydrated,
        calendarHydrated,
        relationsHydrated,
        error,
        initialize,
        hydrateEntities,
        hydrateCalendar,
        hydrateRelations,
        scan,
        scanEntities,
        scanSyntax,
        scanTemporal,
        containsEntities,
        getStatus,
    };
}
