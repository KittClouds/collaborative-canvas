/**
 * Scanner V3 Workers
 * 
 * Web Workers for offloading document scanning operations.
 * 
 * Note: Workers are loaded via Worker constructor, not imported directly.
 * This file exports types only.
 */

export type {
    ScannerWorkerMessage,
    ScannerWorkerResponse,
    EntityData,
    CalendarData,
    EntityMatch,
    SyntaxMatch,
    TemporalMention,
    ScanResult,
    ScannerStatus,
} from './ScannerWorker';
