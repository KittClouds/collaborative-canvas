export interface NEREntity {
    entity_type: string;
    word: string;
    start: number;
    end: number;
    score: number;
}

export interface NERResult {
    entities: NEREntity[];
    text: string;
    timestamp: number;
}

export type NERModelStatus = 'idle' | 'loading' | 'ready' | 'error';
