/**
 * RelationshipInstancesDialog - View all instances of a relationship type
 * 
 * Shows a list of all relationships of a specific type with:
 * - Source and target entity names (clickable)
 * - Confidence indicator
 * - Delete action
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { ArrowRight, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { ENTITY_COLORS, ENTITY_ICONS, type EntityKind } from '@/lib/entities/entityTypes';
import { relationshipBridgeStore } from '@/lib/relationships/RelationshipBridgeStore';
import { useEntitySelectionSafe } from '@/contexts/EntitySelectionContext';
import type { ResolvedRelationshipInstance } from '@/lib/relationships/relationshipBridgeTypes';
import type { RelationshipTypeDef } from '../../types';

interface RelationshipInstancesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    relationshipType: RelationshipTypeDef;
}

export function RelationshipInstancesDialog({
    open,
    onOpenChange,
    relationshipType,
}: RelationshipInstancesDialogProps) {
    const [instances, setInstances] = useState<ResolvedRelationshipInstance[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const entitySelectionContext = useEntitySelectionSafe();

    const loadInstances = useCallback(async () => {
        setIsLoading(true);
        try {
            await relationshipBridgeStore.initialize();
            const results = await relationshipBridgeStore.getInstancesByType(
                relationshipType.relationship_type_id
            );
            setInstances(results);
        } catch (err) {
            console.error('Failed to load instances:', err);
        } finally {
            setIsLoading(false);
        }
    }, [relationshipType.relationship_type_id]);

    useEffect(() => {
        if (open) {
            loadInstances();
        }
    }, [open, loadInstances]);

    const handleDelete = async (relationshipId: string) => {
        if (confirm('Are you sure you want to delete this relationship?')) {
            const success = await relationshipBridgeStore.delete(relationshipId);
            if (success) {
                setInstances((prev) => prev.filter((r) => r.id !== relationshipId));
            }
        }
    };

    const handleNavigate = (entity: { id: string; name: string; kind: EntityKind; noteId?: string }) => {
        if (!entitySelectionContext) return;
        entitySelectionContext.setSelectedEntity({
            kind: entity.kind,
            label: entity.name,
            noteId: entity.noteId || entity.id,
            attributes: {},
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] z-[70]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {relationshipType.display_label}
                        <Badge variant="outline" className="text-xs">
                            {instances.length} instance{instances.length !== 1 ? 's' : ''}
                        </Badge>
                    </DialogTitle>
                    <DialogDescription>
                        All relationships of type "{relationshipType.relationship_name}"
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[400px] pr-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            Loading instances...
                        </div>
                    ) : instances.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No instances of this relationship type exist yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <TooltipProvider>
                                {instances.map((instance) => {
                                    const SourceIcon = ENTITY_ICONS[instance.sourceEntity.kind] || ENTITY_ICONS.CHARACTER;
                                    const TargetIcon = ENTITY_ICONS[instance.targetEntity.kind] || ENTITY_ICONS.CHARACTER;
                                    const sourceColor = ENTITY_COLORS[instance.sourceEntity.kind];
                                    const targetColor = ENTITY_COLORS[instance.targetEntity.kind];

                                    return (
                                        <div
                                            key={instance.id}
                                            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                                        >
                                            {/* Source Entity */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={() => handleNavigate(instance.sourceEntity)}
                                                        className="flex items-center gap-2 hover:text-primary transition-colors"
                                                    >
                                                        <SourceIcon className="w-4 h-4" style={{ color: sourceColor }} />
                                                        <span className="font-medium text-sm">{instance.sourceEntity.name}</span>
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    View {instance.sourceEntity.name}'s Fact Sheet
                                                </TooltipContent>
                                            </Tooltip>

                                            {/* Arrow */}
                                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />

                                            {/* Target Entity */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={() => handleNavigate(instance.targetEntity)}
                                                        className="flex items-center gap-2 hover:text-primary transition-colors"
                                                    >
                                                        <TargetIcon className="w-4 h-4" style={{ color: targetColor }} />
                                                        <span className="font-medium text-sm">{instance.targetEntity.name}</span>
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    View {instance.targetEntity.name}'s Fact Sheet
                                                </TooltipContent>
                                            </Tooltip>

                                            {/* Spacer */}
                                            <div className="flex-1" />

                                            {/* Confidence */}
                                            {instance.confidence < 1.0 && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px]"
                                                    style={{
                                                        borderColor: instance.confidence > 0.7 ? '#22c55e' : '#f59e0b',
                                                        color: instance.confidence > 0.7 ? '#22c55e' : '#f59e0b',
                                                    }}
                                                >
                                                    {Math.round(instance.confidence * 100)}%
                                                </Badge>
                                            )}

                                            {/* Sources */}
                                            <div className="flex gap-1">
                                                {instance.sources.slice(0, 2).map((source) => (
                                                    <Badge key={String(source)} variant="secondary" className="text-[9px]">
                                                        {String(source).replace('_EXTRACTION', '')}
                                                    </Badge>
                                                ))}
                                                {instance.sources.length > 2 && (
                                                    <Badge variant="secondary" className="text-[9px]">
                                                        +{instance.sources.length - 2}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Delete */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(instance.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </TooltipProvider>
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

export default RelationshipInstancesDialog;
