import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, AlertCircle, ChevronDown, Check, X, RefreshCw } from 'lucide-react';
import { glinerService } from '@/lib/ner/gliner-service';
import type { NEREntity } from '@/lib/ner/types';
import { cn } from '@/lib/utils';
import { useNER } from '@/contexts/NERContext';
import { useNotes } from '@/contexts/NotesContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ENTITY_KINDS, ENTITY_COLORS, EntityKind } from '@/lib/entities/entityTypes';

// Intelligent mapping from GLiNER's generic types to your storytelling entities
const NER_TO_ENTITY_MAP: Record<string, string[]> = {
    // People → Character-focused entities
    person: ['CHARACTER', 'NPC'],

    // Places → Location hierarchy
    location: ['LOCATION', 'SCENE'],

    // Groups → Faction types
    organization: ['FACTION'],

    // Happenings → Event and narrative structure
    event: ['EVENT', 'SCENE', 'BEAT'],

    // Objects → Items and concepts
    artifact: ['ITEM', 'CONCEPT'],

    // Additional mappings for any other GLiNER outputs
    misc: ['CONCEPT'],
    work_of_art: ['ITEM', 'CONCEPT'],
    product: ['ITEM'],
};

// Expanded entity types GLiNER should look for
const GLINER_ENTITY_TYPES = [
    'person',
    'location',
    'organization',
    'event',
    'artifact',
    'group',        // Groups of people
    'building',     // Specific structures
    'landmark',     // Notable places
    'object',       // Physical objects
    'concept',      // Abstract ideas
    'title',        // Named works, prophecies
    'creature',     // Fantastical beings
];

interface EntityCardProps {
    entity: NEREntity;
    onAccept: (entity: NEREntity, kind: string) => void;
    onDismiss: (entity: NEREntity) => void;
}

function EntityCard({ entity, onAccept, onDismiss }: EntityCardProps) {
    const possibleKinds = NER_TO_ENTITY_MAP[entity.entity_type] || ['CONCEPT'];
    const [selectedKind, setSelectedKind] = useState<string>(possibleKinds[0]);

    // Get color for selected kind
    const selectedColor = ENTITY_COLORS[selectedKind as EntityKind] || '#6b7280';

    return (
        <div className="p-3 rounded-lg border bg-card group hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-base">{entity.word}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                                backgroundColor: `${selectedColor}20`,
                                color: selectedColor
                            }}
                        >
                            {entity.entity_type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {Math.round(entity.score * 100)}% confidence
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {/* Entity Type Selector - Shows ALL types, grouped by likelihood */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 justify-between"
                            style={{ borderColor: `${selectedColor}40` }}
                        >
                            <span className="truncate font-medium">{selectedKind}</span>
                            <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto">
                        {/* Suggested types first */}
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Suggested
                        </div>
                        {possibleKinds.map((kind) => (
                            <DropdownMenuItem
                                key={kind}
                                onClick={() => setSelectedKind(kind)}
                                className={selectedKind === kind ? 'bg-accent' : ''}
                            >
                                <div
                                    className="w-2 h-2 rounded-full mr-2 shrink-0"
                                    style={{ backgroundColor: ENTITY_COLORS[kind as EntityKind] }}
                                />
                                {kind}
                            </DropdownMenuItem>
                        ))}

                        {/* Divider */}
                        {possibleKinds.length < ENTITY_KINDS.length && (
                            <>
                                <div className="border-t my-1" />
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                    All Types
                                </div>
                                {ENTITY_KINDS.filter(k => !possibleKinds.includes(k)).map((kind) => (
                                    <DropdownMenuItem
                                        key={kind}
                                        onClick={() => setSelectedKind(kind)}
                                        className={selectedKind === kind ? 'bg-accent' : ''}
                                    >
                                        <div
                                            className="w-2 h-2 rounded-full mr-2 shrink-0"
                                            style={{ backgroundColor: ENTITY_COLORS[kind as EntityKind] }}
                                        />
                                        {kind}
                                    </DropdownMenuItem>
                                ))}
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Accept Button */}
                <Button
                    size="sm"
                    variant="default"
                    onClick={() => onAccept(entity, selectedKind)}
                    className="shrink-0"
                    style={{ backgroundColor: selectedColor }}
                >
                    <Check className="h-4 w-4" />
                </Button>

                {/* Dismiss Button */}
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDismiss(entity)}
                    className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// Helper to deduplicate entities
function deduplicateEntities(entities: NEREntity[]): NEREntity[] {
    const seen = new Map<string, NEREntity>();

    for (const entity of entities) {
        const key = `${entity.word.toLowerCase()}-${entity.entity_type}`;
        const existing = seen.get(key);

        // Keep entity with higher confidence score
        if (!existing || entity.score > existing.score) {
            seen.set(key, entity);
        }
    }

    return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}

export function EntitiesPanel() {
    const {
        entities,
        setEntities,
        modelStatus,
        setModelStatus,
        isAnalyzing,
        setIsAnalyzing,
        error,
        setError
    } = useNER();

    const { selectedNote } = useNotes();

    // Load model on demand (not on mount)
    const loadModel = async () => {
        if (glinerService.isLoaded()) {
            setModelStatus('ready');
            return true;
        }

        setModelStatus('loading');
        setError(null);

        try {
            await glinerService.initialize();
            setModelStatus('ready');
            return true;
        } catch (err) {
            setModelStatus('error');
            const errorMsg = err instanceof Error ? err.message : String(err);
            if (errorMsg.includes('<!doctype') || errorMsg.includes('Unexpected token')) {
                setError('Model download failed. Check your internet connection and try again.');
            } else if (errorMsg.includes('Failed to fetch')) {
                setError('Network error. Please check your connection.');
            } else {
                setError(errorMsg);
            }
            return false;
        }
    };

    const handleAnalyze = async () => {
        if (!selectedNote) return;

        // Load model if not ready
        if (modelStatus !== 'ready') {
            const loaded = await loadModel();
            if (!loaded) return;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            // Get plain text content
            let textToAnalyze = '';

            try {
                const json = typeof selectedNote.content === 'string'
                    ? JSON.parse(selectedNote.content)
                    : selectedNote.content;

                if (json.content && Array.isArray(json.content)) {
                    // Recursive text extraction from Tiptap JSON
                    const extractText = (node: any): string => {
                        if (node.text) return node.text;
                        if (node.content) return node.content.map(extractText).join(' ');
                        return '';
                    };
                    textToAnalyze = json.content.map(extractText).join('\n');
                } else {
                    textToAnalyze = String(selectedNote.content);
                }
            } catch (e) {
                textToAnalyze = String(selectedNote.content);
            }

            if (!textToAnalyze || textToAnalyze.trim().length === 0) {
                setError('No text content to analyze');
                setIsAnalyzing(false);
                return;
            }

            // Extract entities with expanded types
            const results = await glinerService.extractEntities(textToAnalyze, GLINER_ENTITY_TYPES);

            // Deduplicate
            const uniqueEntities = deduplicateEntities(results);

            setEntities(uniqueEntities);
            // updateNEREntities(uniqueEntities); // Using setEntities from context which updates global state

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleRetry = () => {
        setError(null);
        setModelStatus('idle');
        loadModel();
    };

    const handleAccept = (entity: NEREntity, kind: string) => {
        console.log('Accepted entity:', entity.word, 'as', kind);
        // Future: Add to Entity database
        // For now, we could remove it from the suggestion list?
        // setEntities(prev => prev.filter(e => e !== entity));
    };

    const handleDismiss = (entity: NEREntity) => {
        setEntities(prev => prev.filter(e => e !== entity));
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b space-y-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Entity Extraction</h2>
                </div>

                {/* Model Status */}
                <div className="flex items-center gap-2 text-sm">
                    {modelStatus === 'idle' && (
                        <>
                            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                            <span className="text-muted-foreground">Model loads on first analysis</span>
                        </>
                    )}
                    {modelStatus === 'loading' && (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            <span className="text-muted-foreground">Downloading model (~50MB)...</span>
                        </>
                    )}
                    {modelStatus === 'ready' && (
                        <>
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="text-muted-foreground">Model ready</span>
                        </>
                    )}
                    {modelStatus === 'error' && (
                        <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                                <span className="text-destructive text-xs">{error}</span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRetry}
                                className="w-full"
                            >
                                <RefreshCw className="h-3 w-3 mr-2" />
                                Retry
                            </Button>
                        </div>
                    )}
                </div>

                {/* Analyze Button */}
                {modelStatus !== 'error' && (
                    <Button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !selectedNote}
                        className="w-full"
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {modelStatus === 'loading' ? 'Loading model...' : 'Analyzing...'}
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                {modelStatus === 'ready' ? 'Analyze Current Note' : 'Load Model & Analyze'}
                            </>
                        )}
                    </Button>
                )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
                {entities.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Click "Analyze" to detect entities</p>
                        <p className="text-xs mt-1 opacity-70">
                            Detects characters, locations, factions, and story elements
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Found {entities.length} suggestions
                            </p>
                            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEntities([])}>
                                Clear All
                            </Button>
                        </div>

                        <div className="space-y-3 pb-8">
                            {entities.map((entity, idx) => (
                                <EntityCard
                                    key={`${entity.word}-${entity.start}-${idx}`}
                                    entity={entity}
                                    onAccept={handleAccept}
                                    onDismiss={handleDismiss}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
