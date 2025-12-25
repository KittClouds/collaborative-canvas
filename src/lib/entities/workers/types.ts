/**
 * Shared types for Entity Matcher Worker
 * Re-export from worker file for convenience
 */

import type { RegisteredEntity } from '../types/registry';
import type {
    EntityMatchRequest,
    EntityMatchResponse
} from './EntityMatcherWorker';

export type {
    EntityMatchRequest,
    EntityMatchResponse
};

/**
 * Result from the worker (raw IDs)
 */
export interface WorkerMatch {
    entityId: string;
    text: string;
    position: number;
    tokenIndex: number;
    sentenceIndex: number;
}

/**
 * Result after resolving entities (with full objects)
 */
export interface WorkerEntityMention {
    entity: RegisteredEntity;
    text: string;
    position: number;
    tokenIndex: number;
    sentenceIndex: number;
}
