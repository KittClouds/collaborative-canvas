import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, AlertCircle, ChevronDown, Check, X, RefreshCw, Book, Lightbulb, Brain, Zap, Settings } from 'lucide-react';
import { extractionService, runNer } from '@/lib/extraction';
import type { NEREntity } from '@/lib/extraction';
import { cn } from '@/lib/utils';
import { useNER } from '@/contexts/NERContext';
import { useNotes } from '@/contexts/NotesContext';
import { useBlueprintHub } from '@/features/blueprint-hub/hooks/useBlueprintHub';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ENTITY_KINDS, ENTITY_COLORS, EntityKind } from '@/lib/entities/entityTypes';
import { getEntityStore, getEdgeStore } from '@/lib/storage/index';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RegisteredEntitiesView } from '@/components/entities/RegisteredEntitiesView';
import { RegistrySettings } from '@/components/entities/RegistrySettings';
import { entityRegistry } from '@/lib/entities/entity-registry';
import { scanDocumentWithExtraction, type EntitySuggestion } from '@/lib/entities/documentScanner';

// Default fallback mapping (for backwards compatibility)
const DEFAULT_NER_TO_ENTITY_MAP: Record<string, string[]> = {
    person: ['CHARACTER', 'NPC'],
    location: ['LOCATION', 'SCENE'],
    organization: ['FACTION'],
    event: ['EVENT', 'SCENE', 'BEAT'],
    artifact: ['ITEM', 'CONCEPT'],
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
    entityTypes?: Array<{ entity_kind: string; color?: string; display_name: string }>;
    possibleKinds: string[];
}

function EntityCard({ entity, onAccept, onDismiss, entityTypes, possibleKinds }: EntityCardProps) {
    const [selectedKind, setSelectedKind] = useState<string>(possibleKinds[0]);

    // Get color for selected kind - check blueprint types first, then fallback to ENTITY_COLORS
    const getEntityColor = (kind: string): string => {
        const blueprintType = entityTypes?.find(t => t.entity_kind === kind);
        if (blueprintType?.color) return blueprintType.color;
        return ENTITY_COLORS[kind as EntityKind] || '#6b7280';
    };

    const selectedColor = getEntityColor(selectedKind);

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
                                    style={{ backgroundColor: getEntityColor(kind) }}
                                />
                                {kind}
                            </DropdownMenuItem>
                        ))}

                        {/* Divider */}
                        {entityTypes && possibleKinds.length < entityTypes.length && (
                            <>
                                <div className="border-t my-1" />
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                    All Types
                                </div>
                                {entityTypes.filter(t => !possibleKinds.includes(t.entity_kind)).map((type) => (
                                    <DropdownMenuItem
                                        key={type.entity_kind}
                                        onClick={() => setSelectedKind(type.entity_kind)}
                                        className={selectedKind === type.entity_kind ? 'bg-accent' : ''}
                                    >
                                        <div
                                            className="w-2 h-2 rounded-full mr-2 shrink-0"
                                            style={{ backgroundColor: getEntityColor(type.entity_kind) }}
                                        />
                                        {type.display_name || type.entity_kind}
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
    const { compiledBlueprint } = useBlueprintHub();
    const { toast } = useToast();

    // New state for model selection
    const [modelType, setModelType] = useState<'ner' | 'extraction'>('ner');

    const getLabelMappings = (): Record<string, string[]> => {
        if (!compiledBlueprint?.extractionProfile?.labelMappings) {
            return DEFAULT_NER_TO_ENTITY_MAP;
        }

        const mappings: Record<string, string[]> = {};
        compiledBlueprint.extractionProfile.labelMappings.forEach((mapping) => {
            mappings[mapping.ner_label.toLowerCase()] = mapping.target_entity_kinds;
        });

        return mappings;
    };

    const loadModel = async (type: 'ner' | 'extraction') => {
        // Don't reload if already loaded and type matches
        if (extractionService.isLoaded() && extractionService.getCurrentModel() === type) {
            setModelStatus('ready');
            return true;
        }

        setModelStatus('loading');
        setError(null);
        setModelType(type);

        try {
            await extractionService.initialize(type);
            setModelStatus('ready');
            return true;
        } catch (err) {
            setModelStatus('error');
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(errorMsg);
            return false;
        }
    };

    const handleAnalyze = async () => {
        if (!selectedNote) return;

        // Ensure model is loaded
        if (modelStatus !== 'ready' || extractionService.getCurrentModel() !== modelType) {
            const loaded = await loadModel(modelType);
            if (!loaded) return;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            let jsonContent;
            try {
                jsonContent = typeof selectedNote.content === 'string'
                    ? JSON.parse(selectedNote.content)
                    : selectedNote.content;
            } catch {
                jsonContent = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: String(selectedNote.content) }] }] };
            }

            if (modelType === 'extraction') {
                // Phase 2: Use LFM2 Extraction
                const result = await scanDocumentWithExtraction(
                    selectedNote.id,
                    jsonContent,
                    {
                        useExtraction: true,
                        autoRegisterHighConfidence: false,
                        confidenceThreshold: 0.7
                    }
                );

                // Map suggestions to NEREntity format
                const newEntities: NEREntity[] = result.suggestions.map(s => ({
                    word: s.label,
                    entity_type: s.kind, // In extraction model, type IS kind
                    score: s.confidence,
                    start: 0, // Not available from structured output easily without re-scanning
                    end: 0
                }));

                setEntities(deduplicateEntities(newEntities));

            } else {
                // Phase 1: Use NER (Existing Logic)

                // Extract plain text for NER
                let textToAnalyze = '';
                if (jsonContent.content && Array.isArray(jsonContent.content)) {
                    const extractText = (node: any): string => {
                        if (node.text) return node.text;
                        if (node.content) return node.content.map(extractText).join(' ');
                        return '';
                    };
                    textToAnalyze = jsonContent.content.map(extractText).join('\n');
                } else {
                    textToAnalyze = JSON.stringify(jsonContent);
                }

                if (!textToAnalyze || textToAnalyze.trim().length === 0) {
                    setError('No text content to analyze');
                    setIsAnalyzing(false);
                    return;
                }

                const results = await runNer(textToAnalyze, { threshold: 0.4 });

                const ignoreList = new Set(
                    compiledBlueprint?.extractionProfile?.ignoreList
                        ?.filter(entry => entry.surface_form)
                        .map(entry => entry.surface_form!.toLowerCase()) || []
                );

                const entities: NEREntity[] = results
                    .filter(span => span.confidence >= 0.4 && !ignoreList.has(span.text.toLowerCase()))
                    .map(span => ({
                        entity_type: span.nerLabel.toLowerCase(),
                        word: span.text,
                        start: span.start,
                        end: span.end,
                        score: span.confidence,
                    }));

                setEntities(deduplicateEntities(entities));
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleRetry = () => {
        setError(null);
        setModelStatus('idle');
        loadModel(modelType);
    };

    const handleAccept = async (entity: NEREntity, kind: string) => {
        if (!selectedNote) return;

        try {
            // Phase 1: Register in EntityRegistry (Singleton)
            // We do extensive import here to emulate lazy loading if needed,
            // but cleaner to just use the one we have globally or import at top.
            // We already imported entityRegistry from lib/entities/entity-registry in other files.
            // But wait, this file doesn't import entityRegistry yet?
            // Let's rely on dynamic import or add it to imports.
            // Actually, I'll add the import dynamically inside this handler to avoid modifying imports again if possible,
            // BUT I already modified imports in previous step.

            // Wait, I did NOT import entityRegistry in previous step.
            // I'll use dynamic import for safety.

            const { entityRegistry } = await import('@/lib/entities/entity-registry');
            const { autoSaveEntityRegistry } = await import('@/lib/storage/entityStorage');

            entityRegistry.registerEntity(entity.word, kind as EntityKind, selectedNote.id);
            autoSaveEntityRegistry(entityRegistry);

            toast({
                title: 'Entity Created',
                description: `"${entity.word}" added as ${kind}`,
            });

            setEntities(prev => prev.filter(e => e !== entity));

        } catch (err) {
            toast({
                title: 'Error',
                description: 'Failed to create entity',
                variant: 'destructive',
            });
            console.error(err);
        }
    };

    const handleDismiss = (entity: NEREntity) => {
        setEntities(prev => prev.filter(e => e !== entity));
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <Tabs defaultValue="registry" className="flex flex-col h-full">
                <div className="px-4 py-2 border-b">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="registry" className="gap-2">
                            <Book className="h-4 w-4" />
                            Registry
                        </TabsTrigger>
                        <TabsTrigger value="suggestions" className="gap-2">
                            <Lightbulb className="h-4 w-4" />
                            Suggestions
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="gap-2">
                            <Settings className="h-4 w-4" />
                            Settings
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="registry" className="flex-1 mt-0 overflow-hidden">
                    <RegisteredEntitiesView />
                </TabsContent>

                <TabsContent value="suggestions" className="flex-1 mt-0 overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b space-y-3">
                        {/* Model Selector */}
                        <div className="flex gap-2">
                            <Button
                                variant={modelType === 'ner' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={() => setModelType('ner')}
                            >
                                <Zap className="h-3 w-3 mr-1" />
                                Fast (NER)
                            </Button>
                            <Button
                                variant={modelType === 'extraction' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={() => setModelType('extraction')}
                            >
                                <Brain className="h-3 w-3 mr-1" />
                                Smart (LLM)
                            </Button>
                        </div>

                        {/* Model Status */}
                        <div className="flex items-center gap-2 text-sm">
                            {modelStatus === 'idle' && (
                                <span className="text-muted-foreground text-xs">Ready to load {modelType === 'ner' ? 'NeuroBERT' : 'LFM2 (350M)'}</span>
                            )}
                            {modelStatus === 'loading' && (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    <span className="text-muted-foreground text-xs">Loading model...</span>
                                </>
                            )}
                            {modelStatus === 'ready' && (
                                <span className="text-green-600 text-xs flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Model active
                                </span>
                            )}
                            {modelStatus === 'error' && (
                                <span className="text-destructive text-xs">{error}</span>
                            )}
                        </div>

                        {/* Analyze Button */}
                        <Button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing || !selectedNote}
                            className="w-full"
                            size="sm"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Scanning...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    {modelStatus === 'ready' ? 'Analyze Note' : 'Load & Analyze'}
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Results */}
                    <div className="flex-1 overflow-auto p-4 space-y-3">
                        {entities.length === 0 ? (
                            <div className="text-center text-muted-foreground text-sm py-8">
                                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>No suggestions found</p>
                                <p className="text-xs mt-1 opacity-70">
                                    Try switching models or adding more text
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
                                    {entities.map((entity, idx) => {
                                        // For LFM2, the entity_type IS the target kind, so map directly
                                        let possibleKinds = [entity.entity_type];

                                        // For NER, we map broad categories to specific kinds
                                        if (modelType === 'ner') {
                                            const labelMappings = getLabelMappings();
                                            possibleKinds = labelMappings[entity.entity_type.toLowerCase()] || ['CONCEPT'];
                                        }

                                        return (
                                            <EntityCard
                                                key={`${entity.word}-${idx}`}
                                                entity={entity}
                                                onAccept={handleAccept}
                                                onDismiss={handleDismiss}
                                                entityTypes={compiledBlueprint?.entityTypes}
                                                possibleKinds={possibleKinds}
                                            />
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="settings" className="flex-1 mt-0 overflow-auto p-4">
                    <RegistrySettings registry={entityRegistry} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
