export type ScannerMessageType =
    | 'INIT'
    | 'INIT_SUCCESS'
    | 'INIT_ERROR'
    | 'SCAN'
    | 'SCAN_RESULT'
    | 'SEARCH'
    | 'SEARCH_RESULT'
    | 'ADD_PATTERN'
    | 'BUILD_REFLEX'
    | 'ERROR';

export interface ScannerMessage {
    type: ScannerMessageType;
    id?: string;
    payload?: any;
    error?: string;
}

export interface InitPayload {
    caseInsensitive?: boolean;
    scorerConfig?: any; // ResoRankConfig
}

export interface AddPatternPayload {
    entityId: string;
    pattern: string;
}

export interface ScanPayload {
    text: string;
    id: string; // Document ID or similar context
}

export interface SearchPayload {
    query: string;
    limit?: number;
}

export interface ScanResult {
    entities: any[];
    syntax: any[];
    temporal: any[];
}
