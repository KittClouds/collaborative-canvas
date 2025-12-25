import { processNote, processFolder, processVault } from '../extraction/batchProcessor';
import { cozoDb } from '../db';
import type { JSONContent } from '@tiptap/react';

export interface ExtractionRequest {
    scope: 'note' | 'folder' | 'vault';
    scopeId: string;
    content?: JSONContent; // For 'note' scope
    notes?: Array<{ id: string; title: string; contentJson: JSONContent }>; // For 'folder' or 'vault' scope
    enableLLM?: boolean;
    llmProvider?: 'gemini' | 'openai' | 'openrouter' | 'anthropic';
    llmApiKey?: string;
    llmModel?: string;
    granularity?: 'block' | 'paragraph' | 'sentence';
}

export interface ExtractionResponse {
    jobId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    currentStep?: string;
    result?: {
        entityCount: number;
        edgeCount: number;
        episodeCount: number;
    };
    error?: string;
}

/**
 * Start extraction job
 */
export async function startExtraction(
    request: ExtractionRequest
): Promise<ExtractionResponse> {
    const jobId = generateJobId();

    // Queue job for background processing
    queueJob(jobId, async (onProgress) => {
        const options = {
            scope: request.scope,
            scopeId: request.scopeId,
            enableLLM: request.enableLLM || false,
            llmConfig: request.enableLLM ? {
                provider: request.llmProvider || 'gemini',
                apiKey: request.llmApiKey!,
                model: request.llmModel,
            } : undefined,
            granularity: request.granularity || 'paragraph',
            onProgress,
        };

        if (request.scope === 'note') {
            if (!request.content) {
                throw new Error('Content is required for note extraction');
            }
            await processNote(request.scopeId, request.content, options);
        } else if (request.scope === 'folder') {
            if (!request.notes) {
                throw new Error('Notes are required for folder extraction');
            }
            await processFolder(request.scopeId, request.notes, options);
        } else {
            if (!request.notes) {
                throw new Error('Notes are required for vault extraction');
            }
            await processVault(request.notes, options);
        }

    });

    return {
        jobId,
        status: 'queued',
        progress: 0,
    };
}

/**
 * Get extraction job status
 */
export async function getExtractionStatus(jobId: string): Promise<ExtractionResponse> {
    const job = getJob(jobId);

    if (!job) {
        throw new Error(`Job not found: ${jobId}`);
    }

    return {
        jobId,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        result: job.result,
        error: job.error,
    };
}

// Job queue implementation (simplified - use BullMQ in production)
const jobs = new Map<string, any>();

function generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function queueJob(jobId: string, fn: (onProgress: (progress: number, step: string) => void) => Promise<void>): void {
    const job = {
        id: jobId,
        status: 'queued',
        progress: 0,
        currentStep: undefined,
        result: undefined,
        error: undefined,
    };

    jobs.set(jobId, job);

    // Execute in background
    setTimeout(async () => {
        job.status = 'processing';

        try {
            await fn((progress: number, step: string) => {
                job.progress = progress;
                job.currentStep = step;
            });

            job.status = 'completed';
        } catch (error: any) {
            job.status = 'failed';
            job.error = error.message;
            console.error(error);
        }
    }, 0);
}

function getJob(jobId: string): any {
    return jobs.get(jobId);
}
