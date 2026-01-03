// src/components/search/RustSearchPanel.tsx
//
// Dedicated Rust/WASM RAG search panel
// Uses RagPipeline for chunking, embedding, and vector search
// Supports dual models (BGE-small, ModernBERT) with Matryoshka truncation

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, Cpu, Loader2, AlertCircle, CheckCircle2, FileText, Database, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useJotaiNotes } from '@/hooks/useJotaiNotes';
import { modelCache } from '@/lib/embeddings/model-cache';
import { dbClient } from '@/lib/db';

type RustStatus = 'idle' | 'loading-model' | 'ready' | 'indexing' | 'searching' | 'error';
type ModelId = 'bge-small' | 'modernbert-base';
type TruncateDim = 'full' | '256' | '128' | '64';

interface RagSearchResult {
    note_id: string;
    note_title: string;
    chunk_text: string;
    score: number;
    chunk_index: number;
}

const MODEL_CONFIG: Record<ModelId, {
    label: string;
    dims: number;
    size: string;
    onnxUrl: string;
    tokenizerUrl: string;
}> = {
    'bge-small': {
        label: 'BGE-small (384d)',
        dims: 384,
        size: '~130MB',
        onnxUrl: 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/onnx/model.onnx',
        tokenizerUrl: 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/tokenizer.json',
    },
    'modernbert-base': {
        label: 'ModernBERT (768d)',
        dims: 768,
        size: '~350MB',
        onnxUrl: 'https://huggingface.co/nomic-ai/modernbert-embed-base/resolve/main/onnx/model.onnx',
        tokenizerUrl: 'https://huggingface.co/nomic-ai/modernbert-embed-base/resolve/main/tokenizer.json',
    },
};

const TRUNCATE_OPTIONS: Record<TruncateDim, { label: string; value: number | null }> = {
    'full': { label: 'Full dims', value: null },
    '256': { label: '256d', value: 256 },
    '128': { label: '128d', value: 128 },
    '64': { label: '64d', value: 64 },
};

export function RustSearchPanel() {
    const { state, selectNote } = useJotaiNotes();
    const notes = state.notes;

    const [status, setStatus] = useState<RustStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [ragPipeline, setRagPipeline] = useState<any>(null);
    const [modelDimensions, setModelDimensions] = useState<number>(0);

    // Model selection
    const [selectedModel, setSelectedModel] = useState<ModelId>('bge-small');
    const [truncateDim, setTruncateDim] = useState<TruncateDim>('full');
    const [loadedModel, setLoadedModel] = useState<ModelId | null>(null);

    // Index stats
    const [indexedChunks, setIndexedChunks] = useState<number>(0);
    const [indexedNotes, setIndexedNotes] = useState<number>(0);

    // Search state
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<RagSearchResult[]>([]);
    const [searchTime, setSearchTime] = useState<number>(0);

    // Hybrid search mode
    const [hybridMode, setHybridMode] = useState<boolean>(false);
    const [vectorWeight, setVectorWeight] = useState<number>(0.5); // 0=pure lexical, 1=pure vector

    // Warn if model changed after indexing
    useEffect(() => {
        if (indexedChunks > 0 && loadedModel && selectedModel !== loadedModel) {
            setError('Model changed. Click "Re-Index All" to use new embeddings.');
        } else if (error?.includes('Model changed')) {
            setError(null);
        }
    }, [selectedModel, loadedModel, indexedChunks, error]);

    // Get effective dimension for display
    const effectiveDim = TRUNCATE_OPTIONS[truncateDim].value ?? MODEL_CONFIG[selectedModel].dims;

    // Load the Rust WASM model
    const handleLoadModel = useCallback(async () => {
        setStatus('loading-model');
        setError(null);
        setResults([]);

        const config = MODEL_CONFIG[selectedModel];

        try {
            const kittcore = await import(
                /* webpackIgnore: true */
                '@kittcore/wasm'
            );
            await kittcore.default();

            // Create RAG pipeline
            const pipeline = new kittcore.RagPipeline();

            // Check cache first
            let onnxBytes: Uint8Array;
            let tokenizerJson: string;

            const cached = await modelCache.get(selectedModel);

            if (cached) {
                console.log(`[RagPipeline] Found ${selectedModel} in cache`);
                onnxBytes = new Uint8Array(cached.onnx);
                tokenizerJson = cached.tokenizer;
            } else {
                console.log(`[RagPipeline] Fetching ${selectedModel} model (${config.size})...`);

                const [onnxRes, tokenizerRes] = await Promise.all([
                    fetch(config.onnxUrl),
                    fetch(config.tokenizerUrl),
                ]);

                if (!onnxRes.ok || !tokenizerRes.ok) {
                    throw new Error('Failed to download model files from HuggingFace');
                }

                onnxBytes = new Uint8Array(await onnxRes.arrayBuffer());
                tokenizerJson = await tokenizerRes.text();

                // Cache for next time
                try {
                    // Create a proper ArrayBuffer copy
                    const onnxArrayBuffer = new ArrayBuffer(onnxBytes.byteLength);
                    new Uint8Array(onnxArrayBuffer).set(onnxBytes);
                    await modelCache.put(selectedModel, onnxArrayBuffer, tokenizerJson);
                } catch (cacheErr) {
                    console.warn('[RagPipeline] Failed to cache model:', cacheErr);
                }
            }

            console.log('[RagPipeline] Loading into WASM...');
            pipeline.loadModel(onnxBytes, tokenizerJson);

            const dims = pipeline.getDimensions();
            setRagPipeline(pipeline);
            setModelDimensions(dims);
            setLoadedModel(selectedModel);

            // Attempt to hydrate from SQLite
            try {
                await dbClient.init();
                const cachedChunks = await dbClient.getRagChunks();

                if (cachedChunks.length > 0) {
                    console.log(`[RagPipeline] Hydrating ${cachedChunks.length} chunks from SQLite...`);
                    let hydrated = 0;

                    for (const chunk of cachedChunks) {
                        // Convert Uint8Array back to Float32Array
                        const embeddingBuffer = chunk.embedding.buffer.slice(
                            chunk.embedding.byteOffset,
                            chunk.embedding.byteOffset + chunk.embedding.byteLength
                        );
                        const embedding = Array.from(new Float32Array(embeddingBuffer));

                        pipeline.insertChunk({
                            id: chunk.id,
                            note_id: chunk.note_id,
                            chunk_index: chunk.chunk_index,
                            text: chunk.text,
                            embedding,
                            note_title: chunk.note_title,
                            start: chunk.start,
                            end: chunk.end,
                        });
                        hydrated++;
                    }

                    // Count unique notes
                    const noteIds = new Set(cachedChunks.map(c => c.note_id));
                    setIndexedNotes(noteIds.size);
                    setIndexedChunks(hydrated);
                    console.log(`[RagPipeline] ✓ Hydrated ${hydrated} chunks from ${noteIds.size} notes`);
                }
            } catch (hydrateErr) {
                console.warn('[RagPipeline] Could not hydrate from SQLite:', hydrateErr);
            }

            setStatus('ready');
            console.log(`[RagPipeline] ✓ ${selectedModel} ready (${dims}d)`);

        } catch (err) {
            console.error('[RagPipeline] Load failed:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setStatus('error');
        }
    }, [selectedModel]);

    // Index all notes
    const handleIndexAll = useCallback(async () => {
        if (!ragPipeline) return;

        setStatus('indexing');
        setError(null);
        const start = performance.now();

        try {
            // Clear existing index
            ragPipeline.clear();

            // Prepare notes for indexing
            const notesToIndex = notes
                .filter(n => n.content && n.content.trim().length > 0)
                .map(n => ({
                    id: n.id,
                    title: n.title || 'Untitled',
                    content: n.content || '',
                }));

            console.log(`[RagPipeline] Indexing ${notesToIndex.length} notes...`);

            // Index each note (could batch, but let's keep it simple for now)
            let totalChunks = 0;
            for (const note of notesToIndex) {
                try {
                    const chunks = ragPipeline.indexNote(note);
                    totalChunks += chunks;
                } catch (err) {
                    console.warn(`[RagPipeline] Failed to index note ${note.id}:`, err);
                }
            }

            setIndexedNotes(notesToIndex.length);
            setIndexedChunks(totalChunks);

            // Persist chunks to SQLite
            try {
                await dbClient.init();
                await dbClient.clearRagChunks();

                // Get all chunks from the pipeline
                const chunks = ragPipeline.getChunks();

                if (chunks && chunks.length > 0) {
                    // Convert to SQLite format
                    const chunksToSave = chunks.map((chunk: any) => ({
                        id: chunk.id,
                        note_id: chunk.note_id,
                        chunk_index: chunk.chunk_index,
                        text: chunk.text,
                        embedding: new Float32Array(chunk.embedding).buffer,
                        note_title: chunk.note_title,
                        start: chunk.start,
                        end: chunk.end,
                        model: loadedModel || selectedModel,
                    }));

                    await dbClient.saveRagChunks(chunksToSave);
                    console.log(`[RagPipeline] ✓ Persisted ${chunksToSave.length} chunks to SQLite`);
                }
            } catch (persistErr) {
                console.warn('[RagPipeline] Failed to persist chunks:', persistErr);
            }

            setStatus('ready');

            console.log(`[RagPipeline] ✓ Indexed ${notesToIndex.length} notes (${totalChunks} chunks) in ${(performance.now() - start).toFixed(0)}ms`);

        } catch (err) {
            console.error('[RagPipeline] Indexing failed:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setStatus('ready');
        }
    }, [ragPipeline, notes, loadedModel, selectedModel]);

    // Execute search
    const executeSearch = useCallback(async () => {
        if (!ragPipeline || !query.trim()) return;

        if (indexedChunks === 0) {
            setError('No notes indexed. Click "Index All" first.');
            return;
        }

        setStatus('searching');
        setError(null);
        const start = performance.now();

        try {
            // Use hybrid or pure vector search based on mode
            let searchResults: RagSearchResult[];
            if (hybridMode) {
                searchResults = ragPipeline.searchHybrid(query, 10, vectorWeight) as RagSearchResult[];
            } else {
                searchResults = ragPipeline.search(query, 10) as RagSearchResult[];
            }

            setResults(searchResults);
            setSearchTime(Math.round(performance.now() - start));
            setStatus('ready');

            console.log(`[RagPipeline] "${query}" → ${searchResults.length} results in ${(performance.now() - start).toFixed(1)}ms (hybrid=${hybridMode})`);

        } catch (err) {
            console.error('[RagPipeline] Search failed:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setStatus('ready');
        }
    }, [ragPipeline, query, indexedChunks]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && status === 'ready') {
            executeSearch();
        }
    };

    const handleResultClick = (noteId: string) => {
        selectNote(noteId);
    };

    const isModelChangePending = loadedModel && selectedModel !== loadedModel;

    return (
        <div className="flex flex-col h-full gap-3 p-2">
            {/* Header Card */}
            <Card className="bg-orange-950/30 border-orange-500/40">
                <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-3">
                        <Cpu className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium text-orange-400">🦀 Rust Embeddings (WASM)</span>
                    </div>

                    {/* Model & Dimension Selectors */}
                    <div className="flex gap-2 mb-3">
                        <Select
                            value={selectedModel}
                            onValueChange={(v) => setSelectedModel(v as ModelId)}
                            disabled={status === 'loading-model' || status === 'indexing'}
                        >
                            <SelectTrigger className="flex-1 h-8 text-xs bg-sidebar-accent border-orange-500/30">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="bge-small">BGE-small (384d, Fast)</SelectItem>
                                <SelectItem value="modernbert-base">ModernBERT (768d, Accurate)</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={truncateDim}
                            onValueChange={(v) => setTruncateDim(v as TruncateDim)}
                            disabled={status === 'loading-model' || status === 'indexing'}
                        >
                            <SelectTrigger className="w-24 h-8 text-xs bg-sidebar-accent border-orange-500/30">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="full">Full</SelectItem>
                                <SelectItem value="256">256d</SelectItem>
                                <SelectItem value="128">128d</SelectItem>
                                <SelectItem value="64">64d</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Hybrid Search Toggle */}
                    {status === 'ready' && indexedChunks > 0 && (
                        <div className="mb-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={hybridMode}
                                        onCheckedChange={setHybridMode}
                                        className="data-[state=checked]:bg-orange-500"
                                    />
                                    <span className="text-xs text-muted-foreground">
                                        Hybrid (BM25 + Vector)
                                    </span>
                                </div>
                                {hybridMode && (
                                    <span className="text-xs text-orange-400">
                                        {Math.round(vectorWeight * 100)}% vector
                                    </span>
                                )}
                            </div>
                            {hybridMode && (
                                <div className="flex items-center gap-2 px-1">
                                    <span className="text-xs text-muted-foreground w-12">Lexical</span>
                                    <Slider
                                        value={[vectorWeight]}
                                        onValueChange={([v]) => setVectorWeight(v)}
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        className="flex-1"
                                    />
                                    <span className="text-xs text-muted-foreground w-12 text-right">Vector</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status */}
                    <div className="text-xs mb-3">
                        {status === 'idle' && (
                            <span className="text-muted-foreground">Click "Load Model" to start</span>
                        )}
                        {status === 'loading-model' && (
                            <span className="flex items-center gap-1 text-orange-400">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Downloading {MODEL_CONFIG[selectedModel].size}...
                            </span>
                        )}
                        {status === 'ready' && (
                            <div className="space-y-1">
                                <span className="flex items-center gap-1 text-green-500">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {loadedModel && MODEL_CONFIG[loadedModel].label} ready ({effectiveDim}d)
                                </span>
                                {indexedChunks > 0 && (
                                    <span className="flex items-center gap-1 text-blue-400">
                                        <Database className="w-3 h-3" />
                                        {indexedNotes} notes / {indexedChunks} chunks indexed
                                    </span>
                                )}
                            </div>
                        )}
                        {status === 'indexing' && (
                            <span className="flex items-center gap-1 text-orange-400">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Chunking & embedding {notes.length} notes...
                            </span>
                        )}
                        {status === 'searching' && (
                            <span className="flex items-center gap-1 text-orange-400">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Searching...
                            </span>
                        )}
                        {status === 'error' && (
                            <span className="flex items-center gap-1 text-red-500">
                                <AlertCircle className="w-3 h-3" />
                                {error}
                            </span>
                        )}
                        {isModelChangePending && status === 'ready' && (
                            <span className="flex items-center gap-1 text-yellow-500 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                Model changed — reload required
                            </span>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        {status === 'idle' || status === 'error' || isModelChangePending ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs h-8 border-orange-500/40 hover:bg-orange-500/20"
                                onClick={handleLoadModel}
                                disabled={status === 'loading-model'}
                            >
                                {isModelChangePending ? 'Reload Model' : 'Load Rust Model'}
                            </Button>
                        ) : status === 'ready' ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs h-8 border-blue-500/40 hover:bg-blue-500/20 text-blue-400"
                                onClick={handleIndexAll}
                            >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                {indexedChunks > 0 ? 'Re-Index All' : 'Index All Notes'}
                            </Button>
                        ) : null}
                    </div>
                </CardContent>
            </Card>

            {/* Search Input (only when indexed) */}
            {status === 'ready' && indexedChunks > 0 && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                    <Input
                        placeholder="🦀 Search with Rust RAG..."
                        className="pl-9 pr-2 bg-sidebar-accent border-orange-500/30 focus-visible:ring-1 focus-visible:ring-orange-500"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
            )}

            {/* Search Metadata */}
            {results.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                    <span>{results.length} results</span>
                    <span>•</span>
                    <span>{indexedNotes} notes searched</span>
                    <span>•</span>
                    <span>{searchTime}ms</span>
                    <span className="text-orange-400">• Rust/WASM</span>
                </div>
            )}

            {/* Results */}
            {status === 'searching' ? (
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
                </div>
            ) : results.length > 0 ? (
                <ScrollArea className="flex-1">
                    <div className="space-y-2 pr-3">
                        {results.map((result, idx) => (
                            <Card
                                key={`${result.note_id}_${result.chunk_index}`}
                                className="cursor-pointer hover:bg-orange-950/30 transition-colors border-orange-500/20"
                                onClick={() => handleResultClick(result.note_id)}
                            >
                                <CardContent className="p-3 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <FileText className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-medium truncate">{result.note_title}</h4>
                                                <span className="text-xs text-muted-foreground">Chunk {result.chunk_index + 1}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs font-medium text-orange-400">
                                                {(result.score * 100).toFixed(1)}%
                                            </span>
                                            <span className="px-1.5 py-0.5 text-xs bg-orange-950/50 text-orange-300 rounded">
                                                #{idx + 1}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {result.chunk_text.slice(0, 150)}
                                        {result.chunk_text.length > 150 && '...'}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            ) : query && status === 'ready' && indexedChunks > 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    Press Enter to search
                </div>
            ) : status === 'ready' && indexedChunks === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    Click "Index All Notes" to enable search
                </div>
            ) : status === 'ready' ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    Enter a search query above
                </div>
            ) : null}
        </div>
    );
}
