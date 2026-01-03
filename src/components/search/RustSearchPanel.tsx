// src/components/search/RustSearchPanel.tsx
//
// Premium Rust/WASM semantic search panel
// Dark teal aesthetic matching app design

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
    Search,
    Cpu,
    Zap,
    Layers,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ChevronDown,
    FileText,
    Sparkles,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useJotaiNotes } from '@/hooks/useJotaiNotes';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { ModelId } from '@/lib/rag';

// Types
type RagStatus = 'idle' | 'initializing' | 'loading-model' | 'ready' | 'indexing' | 'searching' | 'error';
type SearchMode = 'vector' | 'hybrid' | 'raptor';
type TruncateDim = 'full' | '256' | '128' | '64';

interface SearchResult {
    note_id: string;
    note_title: string;
    chunk_text: string;
    score: number;
    chunk_index: number;
}

interface RagStats {
    notes: number;
    chunks: number;
}

export function RustSearchPanel() {
    const { state, selectNote } = useJotaiNotes();
    const notes = state?.notes ?? [];
    const workerRef = useRef<Worker | null>(null);

    // State
    const [status, setStatus] = useState<RagStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<RagStats>({ notes: 0, chunks: 0 });
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searchTime, setSearchTime] = useState<number>(0);

    // Model config
    const [selectedModel, setSelectedModel] = useState<ModelId>('bge-small');
    const [truncateDim, setTruncateDim] = useState<TruncateDim>('full');
    const [searchMode, setSearchMode] = useState<SearchMode>('vector');
    const [vectorWeight, setVectorWeight] = useState(0.7);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Initialize worker
    useEffect(() => {
        const worker = new Worker(
            new URL('@/workers/rag.worker.ts', import.meta.url),
            { type: 'module' }
        );

        worker.onmessage = (e) => {
            const msg = e.data;
            switch (msg.type) {
                case 'INIT_COMPLETE':
                    setStatus('idle');
                    break;
                case 'MODEL_LOADED':
                    setStatus('ready');
                    break;
                case 'INDEX_COMPLETE':
                    setStats({ notes: msg.payload.notes, chunks: msg.payload.chunks });
                    setStatus('ready');
                    break;
                case 'SEARCH_RESULTS':
                    setResults(msg.payload.results || []);
                    setStatus('ready');
                    break;
                case 'ERROR':
                    setError(msg.payload.message);
                    setStatus('error');
                    break;
            }
        };

        workerRef.current = worker;
        worker.postMessage({ type: 'INIT' });
        setStatus('initializing');

        return () => worker.terminate();
    }, []);

    // Load model
    const loadModel = useCallback(async () => {
        if (!workerRef.current) return;
        setStatus('loading-model');
        setError(null);

        try {
            const modelPath = selectedModel === 'bge-small'
                ? 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/onnx/model.onnx'
                : 'https://huggingface.co/answerdotai/ModernBERT-base/resolve/main/onnx/model.onnx';

            const tokenizerPath = selectedModel === 'bge-small'
                ? 'https://huggingface.co/BAAI/bge-small-en-v1.5/resolve/main/tokenizer.json'
                : 'https://huggingface.co/answerdotai/ModernBERT-base/resolve/main/tokenizer.json';

            const [onnxRes, tokenizerRes] = await Promise.all([
                fetch(modelPath),
                fetch(tokenizerPath),
            ]);

            if (!onnxRes.ok || !tokenizerRes.ok) {
                throw new Error('Failed to download model files');
            }

            const onnx = await onnxRes.arrayBuffer();
            const tokenizer = await tokenizerRes.text();

            workerRef.current.postMessage({
                type: 'LOAD_MODEL',
                payload: {
                    onnx,
                    tokenizer,
                    dims: selectedModel === 'bge-small' ? 384 : 768,
                    truncate: truncateDim,
                },
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Model load failed');
            setStatus('error');
        }
    }, [selectedModel, truncateDim]);

    // Index notes
    const indexNotes = useCallback(() => {
        if (!workerRef.current || status !== 'ready') return;
        setStatus('indexing');

        const notesToIndex = notes.map((n) => ({
            id: n.id,
            title: n.title || 'Untitled',
            content: n.content || '',
        }));

        workerRef.current.postMessage({
            type: 'INDEX_NOTES',
            payload: { notes: notesToIndex },
        });
    }, [notes, status]);

    // Search
    const handleSearch = useCallback(() => {
        if (!workerRef.current || !query.trim() || status !== 'ready') return;

        const start = performance.now();
        setStatus('searching');

        if (searchMode === 'hybrid') {
            workerRef.current.postMessage({
                type: 'SEARCH_HYBRID',
                payload: { query, k: 10, vectorWeight, lexicalWeight: 1 - vectorWeight },
            });
        } else if (searchMode === 'raptor') {
            workerRef.current.postMessage({
                type: 'SEARCH_RAPTOR',
                payload: { query, k: 10, mode: 'hybrid' },
            });
        } else {
            workerRef.current.postMessage({
                type: 'SEARCH',
                payload: { query, k: 10 },
            });
        }

        // Track time (approximate since async)
        setTimeout(() => setSearchTime(Math.round(performance.now() - start)), 0);
    }, [query, status, searchMode, vectorWeight]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleResultClick = (noteId: string) => {
        selectNote(noteId);
    };

    // Status display
    const getStatusDisplay = () => {
        switch (status) {
            case 'idle':
                return { icon: Cpu, text: 'Not initialized', color: 'text-zinc-500' };
            case 'initializing':
                return { icon: Loader2, text: 'Initializing WASM...', color: 'text-teal-400', spin: true };
            case 'loading-model':
                return { icon: Loader2, text: 'Loading model...', color: 'text-teal-400', spin: true };
            case 'ready':
                return { icon: CheckCircle2, text: 'Ready', color: 'text-emerald-400' };
            case 'indexing':
                return { icon: Loader2, text: 'Indexing...', color: 'text-teal-400', spin: true };
            case 'searching':
                return { icon: Loader2, text: 'Searching...', color: 'text-teal-400', spin: true };
            case 'error':
                return { icon: AlertCircle, text: 'Error', color: 'text-red-400' };
            default:
                return { icon: Cpu, text: 'Unknown', color: 'text-zinc-500' };
        }
    };

    const statusInfo = getStatusDisplay();
    const StatusIcon = statusInfo.icon;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-zinc-900 via-zinc-900 to-teal-950/40 border border-teal-500/20 p-4 mb-4">
                {/* Subtle glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-transparent to-cyan-500/5 pointer-events-none" />

                <div className="relative">
                    {/* Title row */}
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-teal-500/30">
                            <Sparkles className="w-5 h-5 text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-zinc-100">Semantic Search</h2>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-zinc-500">Rust/WASM</span>
                                <span className="text-zinc-600">•</span>
                                <span className="text-teal-400 font-medium">{selectedModel === 'bge-small' ? 'BGE-small' : 'ModernBERT'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                            "bg-zinc-800/80 border border-zinc-700/50"
                        )}>
                            <StatusIcon className={cn("w-3 h-3", statusInfo.color, statusInfo.spin && "animate-spin")} />
                            <span className={statusInfo.color}>{statusInfo.text}</span>
                        </div>

                        {stats.chunks > 0 && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-500/10 border border-teal-500/20 text-teal-300">
                                <FileText className="w-3 h-3" />
                                {stats.chunks} chunks
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                    placeholder="Search your notes..."
                    className="pl-9 pr-3 h-10 bg-zinc-900/60 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500 focus:border-teal-500/50 focus:ring-teal-500/20"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={status !== 'ready'}
                />
            </div>

            {/* Search Mode Toggles */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900/60 border border-zinc-800/50 mb-3">
                <button
                    onClick={() => setSearchMode('vector')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200",
                        searchMode === 'vector'
                            ? "bg-gradient-to-r from-teal-500/20 to-cyan-500/10 text-teal-300 border border-teal-500/30 shadow-sm shadow-teal-500/10"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                    )}
                >
                    <Zap className="w-3.5 h-3.5" />
                    Vector
                </button>
                <button
                    onClick={() => setSearchMode('hybrid')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200",
                        searchMode === 'hybrid'
                            ? "bg-gradient-to-r from-teal-500/20 to-cyan-500/10 text-teal-300 border border-teal-500/30 shadow-sm shadow-teal-500/10"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                    )}
                >
                    <Layers className="w-3.5 h-3.5" />
                    Hybrid
                </button>
                <button
                    onClick={() => setSearchMode('raptor')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200",
                        searchMode === 'raptor'
                            ? "bg-gradient-to-r from-teal-500/20 to-cyan-500/10 text-teal-300 border border-teal-500/30 shadow-sm shadow-teal-500/10"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                    )}
                >
                    <Cpu className="w-3.5 h-3.5" />
                    RAPTOR
                </button>
            </div>

            {/* Advanced Settings */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="mb-3">
                <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-zinc-900/40 border border-zinc-800/30 text-xs text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900/60 transition-colors">
                        <span className="flex items-center gap-2">
                            <Cpu className="w-3.5 h-3.5" />
                            Model Settings
                        </span>
                        <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-180")} />
                    </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 space-y-3">
                    {/* Model Selection */}
                    <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/30 space-y-3">
                        <div className="text-xs text-zinc-400 font-medium mb-2">Embedding Model</div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setSelectedModel('bge-small')}
                                className={cn(
                                    "p-2 rounded-md text-xs text-left transition-all",
                                    selectedModel === 'bge-small'
                                        ? "bg-teal-500/10 border border-teal-500/30 text-teal-300"
                                        : "bg-zinc-800/50 border border-zinc-700/30 text-zinc-400 hover:text-zinc-300"
                                )}
                            >
                                <div className="font-medium">BGE-small</div>
                                <div className="text-zinc-500 text-[10px]">384d • Fast</div>
                            </button>
                            <button
                                onClick={() => setSelectedModel('modernbert-base')}
                                className={cn(
                                    "p-2 rounded-md text-xs text-left transition-all",
                                    selectedModel === 'modernbert-base'
                                        ? "bg-teal-500/10 border border-teal-500/30 text-teal-300"
                                        : "bg-zinc-800/50 border border-zinc-700/30 text-zinc-400 hover:text-zinc-300"
                                )}
                            >
                                <div className="font-medium">ModernBERT</div>
                                <div className="text-zinc-500 text-[10px]">768d • Accurate</div>
                            </button>
                        </div>

                        {/* Truncation */}
                        <div className="text-xs text-zinc-400 font-medium mt-3 mb-2">Dimension Truncation</div>
                        <div className="grid grid-cols-4 gap-1">
                            {(['full', '256', '128', '64'] as TruncateDim[]).map((dim) => (
                                <button
                                    key={dim}
                                    onClick={() => setTruncateDim(dim)}
                                    className={cn(
                                        "py-1.5 rounded text-xs font-medium transition-all",
                                        truncateDim === dim
                                            ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                                            : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300"
                                    )}
                                >
                                    {dim === 'full' ? 'Full' : `${dim}d`}
                                </button>
                            ))}
                        </div>

                        {/* Hybrid weight slider */}
                        {searchMode === 'hybrid' && (
                            <div className="mt-3">
                                <div className="flex justify-between text-xs text-zinc-400 mb-2">
                                    <span>Vector Weight</span>
                                    <span className="text-teal-400">{(vectorWeight * 100).toFixed(0)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={vectorWeight}
                                    onChange={(e) => setVectorWeight(parseFloat(e.target.value))}
                                    className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-teal-500"
                                />
                            </div>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {/* Action Buttons */}
            <div className="flex gap-2 mb-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={loadModel}
                    disabled={status === 'loading-model' || status === 'initializing'}
                    className="flex-1 h-9 text-xs bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-teal-500/30"
                >
                    {status === 'loading-model' ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                        <Cpu className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Load Model
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={indexNotes}
                    disabled={status !== 'ready'}
                    className="flex-1 h-9 text-xs bg-zinc-900/60 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-teal-500/30"
                >
                    {status === 'indexing' ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                        <Zap className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Index ({notes.length})
                </Button>
            </div>

            {/* Error display */}
            {error && (
                <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Results */}
            <div className="flex-1 overflow-auto">
                {results.length > 0 ? (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                            <span>{results.length} results</span>
                            <span>{searchTime}ms</span>
                        </div>
                        {results.map((result, i) => (
                            <button
                                key={`${result.note_id}-${result.chunk_index}`}
                                onClick={() => handleResultClick(result.note_id)}
                                className="w-full p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/30 text-left hover:bg-zinc-900/60 hover:border-teal-500/20 transition-all group"
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm font-medium text-zinc-200 group-hover:text-teal-300 transition-colors truncate">
                                        {result.note_title}
                                    </span>
                                    <span className="text-xs font-mono text-teal-400 shrink-0 ml-2">
                                        {(result.score * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-500 line-clamp-2">
                                    {result.chunk_text.slice(0, 150)}...
                                </p>
                            </button>
                        ))}
                    </div>
                ) : query && status === 'ready' ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                        <Search className="w-8 h-8 text-zinc-700 mb-2" />
                        <p className="text-sm text-zinc-500">No results found</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                        <Sparkles className="w-8 h-8 text-zinc-700 mb-2" />
                        <p className="text-sm text-zinc-500">Enter a query to semantic search</p>
                    </div>
                )}
            </div>
        </div>
    );
}
