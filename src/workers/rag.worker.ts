/// <reference lib="webworker" />

import init, { RagPipeline } from '@/lib/wasm/kittcore/kittcore';
import { normalizeEmbedding, getEmbeddingMeta, validateDimension, truncateEmbedding } from '@/lib/rag/embedding-utils';

// Types for messages
type WorkerMessage =
    | { type: 'INIT' }
    | { type: 'LOAD_MODEL'; payload: { onnx: ArrayBuffer; tokenizer: string; dims?: number; truncate?: string } }
    | { type: 'INDEX_NOTES'; payload: { notes: Array<{ id: string; title: string; content: string }> } }
    | { type: 'BUILD_RAPTOR'; payload: { clusterSize: number } }
    | { type: 'SEARCH'; payload: { query: string; k: number } }
    | { type: 'SEARCH_HYBRID'; payload: { query: string; k: number; vectorWeight: number; lexicalWeight: number } }
    | { type: 'SEARCH_RAPTOR'; payload: { query: string; k: number; mode: string } } // Accepts text query now
    | { type: 'HYDRATE'; payload: { chunks: Array<any> } }
    | { type: 'GET_CHUNKS' };

type ResponseMessage =
    | { type: 'INIT_COMPLETE' }
    | { type: 'MODEL_LOADED' }
    | { type: 'INDEX_COMPLETE'; payload: { notes: number; chunks: number } }
    | { type: 'RAPTOR_BUILT'; payload: { stats: any } }
    | { type: 'SEARCH_RESULTS'; payload: { results: any[] } }
    | { type: 'CHUNKS_RETRIEVED'; payload: { chunks: any[] } }
    | { type: 'ERROR'; payload: { message: string } };

// Worker state
let pipeline: RagPipeline | null = null;
let initialized = false;
let currentModelDim = 384;
let currentTruncateDim: number | null = null;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const msg = e.data;
    console.log('[RagWorker] Received:', msg.type);

    try {
        switch (msg.type) {
            case 'INIT':
                if (!initialized) {
                    await init();
                    pipeline = new RagPipeline();
                    initialized = true;
                }
                self.postMessage({ type: 'INIT_COMPLETE' });
                break;

            case 'LOAD_MODEL':
                if (!pipeline) throw new Error('Pipeline not initialized');
                const { onnx, tokenizer, dims, truncate } = msg.payload as any;

                pipeline.loadModel(new Uint8Array(onnx), tokenizer);

                // Update state
                currentModelDim = dims || 384;
                currentTruncateDim = truncate && truncate !== 'full' ? Number(truncate) : null;

                console.log(`[RagWorker] Model loaded. Native Dim: ${currentModelDim}, Truncate: ${currentTruncateDim || 'None'}`);

                self.postMessage({ type: 'MODEL_LOADED' });
                break;

            case 'INDEX_NOTES':
                if (!pipeline) throw new Error('Pipeline not initialized');
                const notes = msg.payload.notes;

                // Note: Rust currently forces full model dimension. Matryoshka slicing happens at search time for now
                // or requires rust changes. For now we index full vectors.
                const totalChunks = pipeline.indexNotes(notes);

                self.postMessage({
                    type: 'INDEX_COMPLETE',
                    payload: { notes: notes.length, chunks: totalChunks }
                });
                break;

            case 'BUILD_RAPTOR':
                if (!pipeline) throw new Error('Pipeline not initialized');
                const stats = pipeline.buildRaptorTree(msg.payload.clusterSize);
                self.postMessage({ type: 'RAPTOR_BUILT', payload: { stats } });
                break;

            case 'SEARCH':
                if (!pipeline) throw new Error('Pipeline not initialized');
                const results = pipeline.search(msg.payload.query, msg.payload.k);
                self.postMessage({ type: 'SEARCH_RESULTS', payload: { results } });
                break;

            case 'SEARCH_HYBRID':
                if (!pipeline) throw new Error('Pipeline not initialized');
                const { query, k, vectorWeight } = msg.payload;
                const hResults = pipeline.searchHybrid(query, k, vectorWeight);
                self.postMessage({ type: 'SEARCH_RESULTS', payload: { results: hResults } });
                break;

            case 'SEARCH_RAPTOR':
                if (!pipeline) throw new Error('Pipeline not initialized');
                const { query: rQuery, k: rK, mode } = msg.payload;
                const embedding = pipeline.embed(rQuery);
                const raptorResults = pipeline.searchRaptor(new Float32Array(embedding), rK, mode, 10);
                self.postMessage({ type: 'SEARCH_RESULTS', payload: { results: raptorResults } });
                break;

            case 'HYDRATE':
                if (!pipeline) throw new Error('Pipeline not initialized');
                const { chunks } = msg.payload;
                let hydratedCount = 0;
                let skippedCount = 0;

                // Filter chunks that match current dimensionality
                const targetDim = currentTruncateDim || currentModelDim; // Ideally match model

                for (const chunk of chunks) {
                    // Use centralized utility for robust format conversion
                    let emb = normalizeEmbedding(chunk.embedding);
                    const meta = getEmbeddingMeta(chunk.embedding);

                    // Validate dimension matches model
                    if (!validateDimension(emb, currentModelDim)) {
                        // Truncation support: if source is larger, we can slice
                        if (currentTruncateDim && emb.length > currentTruncateDim) {
                            emb = truncateEmbedding(emb, currentTruncateDim);
                        } else {
                            console.debug(`[RagWorker] Skipping chunk: dim ${emb.length} != expected ${currentModelDim}`);
                            skippedCount++;
                            continue;
                        }
                    } else if (currentTruncateDim && currentTruncateDim < emb.length) {
                        // Model dim matches but truncation requested
                        emb = truncateEmbedding(emb, currentTruncateDim);
                    }

                    try {
                        pipeline.insertChunk({
                            ...chunk,
                            embedding: emb
                        });
                        hydratedCount++;
                    } catch (e) {
                        console.warn('[RagWorker] insertChunk failed:', e);
                        skippedCount++;
                    }
                }
                console.log(`[RagWorker] Hydrated ${hydratedCount} chunks, skipped ${skippedCount}`);
                self.postMessage({ type: 'INDEX_COMPLETE', payload: { notes: 0, chunks: hydratedCount } });
                break;

            case 'GET_CHUNKS':
                // ... existing
                if (!pipeline) throw new Error('Pipeline not initialized');
                const allChunks = pipeline.getChunks();
                self.postMessage({ type: 'CHUNKS_RETRIEVED', payload: { chunks: allChunks } });
                break;
        }
    } catch (e) {
        console.error('[RagWorker] Error:', e);
        self.postMessage({ type: 'ERROR', payload: { message: e instanceof Error ? e.message : String(e) } });
    }
};
