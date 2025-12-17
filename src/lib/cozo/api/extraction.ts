import { processNote, processFolder, processVault } from '../extraction/batchProcessor';
import { cozoDb } from '../db';

export interface ExtractionRequest {
    scope: 'note' | 'folder' | 'vault';
    scopeId: string;
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
            // Fetch note content
            const note = await fetchNote(request.scopeId);
            await processNote(request.scopeId, note.contentJson, options);
        } else if (request.scope === 'folder') {
            await processFolder(request.scopeId, options);
        } else {
            await processVault(options);
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
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function queueJob(jobId: string, fn: (onProgress: any) => Promise<void>): void {
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

async function fetchNote(noteId: string): Promise<any> {
    const result = await cozoDb.runQuery(`
        ?[id, title, content_json] := *note{id, title, content_json},
        id == $id
    `, { id: noteId });
    if (result.rows && result.rows.length > 0) {
        return {
            id: result.rows[0][0],
            title: result.rows[0][1],
            contentJson: result.rows[0][2]
        };
    }
    throw new Error(`Note not found: ${noteId}`);
}
