import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Search, ArrowRight, ArrowLeftRight, Minus, User, Sparkles } from 'lucide-react';
import { ENTITY_COLORS, ENTITY_ICONS, type EntityKind } from '@/lib/types/entityTypes';
import { useEntitySelectionSafe } from '@/contexts/EntitySelectionContext';
import { cn } from '@/lib/utils';
import {
    RELATIONSHIP_PRESETS,
    PRESET_CATEGORIES,
    type RelationshipPreset,
    type PresetCategory,
} from './relationshipPresets';

interface BlueprintsTabProps {
    onSelectPreset: (preset: RelationshipPreset, sourceEntity?: { id: string; name: string; kind: EntityKind }) => void;
}

function DirectionIcon({ direction }: { direction: string }) {
    switch (direction) {
        case 'bidirectional':
            return <ArrowLeftRight className="w-3 h-3" />;
        case 'undirected':
            return <Minus className="w-3 h-3" />;
        default:
            return <ArrowRight className="w-3 h-3" />;
    }
}

export function BlueprintsTab({ onSelectPreset }: BlueprintsTabProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<Set<PresetCategory>>(new Set());
    const entitySelectionContext = useEntitySelectionSafe();
    const selectedEntity = entitySelectionContext?.selectedEntity ?? null;

    // Check if a preset is applicable to the selected entity
    const isPresetApplicable = (preset: RelationshipPreset) => {
        if (!selectedEntity) return false;
        return preset.source_entity_kind === selectedEntity.kind;
    };

    const filteredPresets = useMemo(() => {
        return RELATIONSHIP_PRESETS.filter((preset) => {
            if (selectedCategories.size > 0 && !selectedCategories.has(preset.category)) {
                return false;
            }

            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                return (
                    preset.name.toLowerCase().includes(query) ||
                    preset.description.toLowerCase().includes(query) ||
                    preset.display_label.toLowerCase().includes(query)
                );
            }

            return true;
        });
    }, [searchQuery, selectedCategories]);

    const toggleCategory = (category: PresetCategory) => {
        const newSet = new Set(selectedCategories);
        if (newSet.has(category)) {
            newSet.delete(category);
        } else {
            newSet.add(category);
        }
        setSelectedCategories(newSet);
    };

    return (
        <div className="flex flex-col h-full space-y-4 p-1">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search blueprints..."
                    className="pl-9"
                />
            </div>

            <div className="flex gap-2 flex-wrap">
                {PRESET_CATEGORIES.map((category) => (
                    <Badge
                        key={category.id}
                        variant={selectedCategories.has(category.id) ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors"
                        style={{
                            backgroundColor: selectedCategories.has(category.id) ? category.color : undefined,
                            borderColor: category.color,
                            color: selectedCategories.has(category.id) ? 'white' : category.color,
                        }}
                        onClick={() => toggleCategory(category.id)}
                    >
                        {category.label}
                    </Badge>
                ))}
                {selectedCategories.size > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setSelectedCategories(new Set())}
                    >
                        Clear
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 overflow-y-auto flex-1 pb-4">
                <TooltipProvider>
                    {filteredPresets.map((preset) => {
                        const SourceIcon = ENTITY_ICONS[preset.source_entity_kind];
                        const TargetIcon = ENTITY_ICONS[preset.target_entity_kind];
                        const sourceColor = ENTITY_COLORS[preset.source_entity_kind];
                        const targetColor = ENTITY_COLORS[preset.target_entity_kind];
                        const categoryInfo = PRESET_CATEGORIES.find(c => c.id === preset.category);

                        return (
                            <Tooltip key={preset.id}>
                                <TooltipTrigger asChild>
                                    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer group">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <SourceIcon className="w-5 h-5" style={{ color: sourceColor }} />
                                                <DirectionIcon direction={preset.direction} />
                                                <TargetIcon className="w-5 h-5" style={{ color: targetColor }} />
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] px-1.5"
                                                style={{ borderColor: categoryInfo?.color, color: categoryInfo?.color }}
                                            >
                                                {categoryInfo?.label}
                                            </Badge>
                                        </div>

                                        <h4 className="font-semibold text-sm mb-1">{preset.name}</h4>

                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                                            <span style={{ color: sourceColor }}>{preset.source_entity_kind}</span>
                                            <DirectionIcon direction={preset.direction} />
                                            <span style={{ color: targetColor }}>{preset.target_entity_kind}</span>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="w-full opacity-80 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectPreset(preset);
                                                }}
                                            >
                                                Use This Blueprint
                                            </Button>
                                            {selectedEntity && isPresetApplicable(preset) && (
                                                <Button
                                                    size="sm"
                                                    variant="default"
                                                    className="w-full gap-1.5"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelectPreset(preset, {
                                                            id: selectedEntity.noteId || `${selectedEntity.kind}::${selectedEntity.label}`,
                                                            name: selectedEntity.label,
                                                            kind: selectedEntity.kind as EntityKind,
                                                        });
                                                    }}
                                                >
                                                    <Sparkles className="w-3 h-3" />
                                                    Use With {selectedEntity.label}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                    <p className="text-sm">{preset.description}</p>
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </TooltipProvider>

                {filteredPresets.length === 0 && (
                    <div className="col-span-2 text-center py-12 text-muted-foreground">
                        <p>No blueprints match your search.</p>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedCategories(new Set());
                            }}
                        >
                            Clear filters
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
