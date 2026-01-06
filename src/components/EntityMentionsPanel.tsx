import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, ChevronDown, ChevronRight, Trash2, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ENTITY_COLORS, EntityKind } from '@/lib/types/entityTypes';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { BacklinkInfo } from '@/lib/linking/LinkIndex';

interface EntityStats {
    entityKind: EntityKind;
    entityLabel: string;
    mentionsInThisNote: number;
    mentionsAcrossVault: number;
    appearanceCount: number;
    id?: string; // Entity ID for deletion
}

interface EntityMentionsPanelProps {
    entityStats: EntityStats[];
    getEntityMentions: (label: string, kind?: EntityKind) => BacklinkInfo[];
    onNavigate: (title: string) => void;
    onDeleteEntity?: (id: string, label: string) => Promise<void>;
}


export function EntityMentionsPanel({
    entityStats,
    getEntityMentions,
    onNavigate,
    onDeleteEntity,
}: EntityMentionsPanelProps) {
    const [expandedEntities, setExpandedEntities] = useState<Set<string>>(
        new Set()
    );
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const toggleEntity = (key: string) => {
        setExpandedEntities((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const handleDelete = async (entity: EntityStats, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onDeleteEntity || !entity.id) return;

        setDeletingId(entity.id);
        try {
            await onDeleteEntity(entity.id, entity.entityLabel);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <Card className="h-full flex flex-col border-0 bg-transparent shadow-none">
            <CardHeader className="pb-3 px-3 pt-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Entity Mentions
                    <Badge variant="secondary" className="ml-auto">
                        {entityStats.length}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
                <ScrollArea className="h-full px-3">
                    {entityStats.length === 0 ? (
                        <div className="text-center text-sm text-muted-foreground py-8">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p>No entities found</p>
                            <p className="text-xs mt-1 opacity-70">
                                Use [TYPE|Label] syntax to create entity references
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2 pb-4">
                            {entityStats.map((entity, index) => {
                                const color = ENTITY_COLORS[entity.entityKind] || '#6b7280';
                                const entityKey = `${entity.entityKind}:${entity.entityLabel}`;
                                // Use index in React key to handle duplicate entities in the array
                                const reactKey = `${entityKey}-${index}`;
                                const isExpanded = expandedEntities.has(entityKey);
                                const mentions = getEntityMentions(
                                    entity.entityLabel,
                                    entity.entityKind
                                );
                                const isDeleting = deletingId === entity.id;

                                return (
                                    <Collapsible
                                        key={reactKey}
                                        open={isExpanded}
                                        onOpenChange={() => toggleEntity(entityKey)}
                                    >
                                        <div className="rounded-md border bg-card group">
                                            {/* Header row with trigger and actions */}
                                            <div className="flex items-center p-3 hover:bg-accent/50 transition-colors">
                                                <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0 text-left">
                                                    {isExpanded ? (
                                                        <ChevronDown className="h-4 w-4 shrink-0" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 shrink-0" />
                                                    )}
                                                    <Badge
                                                        variant="outline"
                                                        className="text-xs shrink-0"
                                                        style={{
                                                            backgroundColor: `${color}20`,
                                                            color,
                                                            borderColor: `${color}40`,
                                                        }}
                                                    >
                                                        {entity.entityKind}
                                                    </Badge>
                                                    <span
                                                        className="font-medium text-sm flex-1 truncate"
                                                        style={{ color }}
                                                    >
                                                        {entity.entityLabel}
                                                    </span>
                                                </CollapsibleTrigger>

                                                {/* Actions - outside trigger */}
                                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                                    {/* Delete button with confirmation */}
                                                    {onDeleteEntity && entity.id && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                                                    disabled={isDeleting}
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Delete Entity</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Are you sure you want to delete <strong>{entity.entityLabel}</strong>?
                                                                        This will remove it from the registry. Entity mentions in your notes will remain unchanged.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                        onClick={(e) => handleDelete(entity, e)}
                                                                    >
                                                                        Delete
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                    <Badge variant="secondary" className="text-xs">
                                                        {entity.appearanceCount} notes
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CollapsibleContent>
                                                <div className="px-3 pb-3 space-y-1">
                                                    {mentions.length === 0 ? (
                                                        <div className="text-xs text-muted-foreground py-2 px-2">
                                                            No mentions in other notes
                                                        </div>
                                                    ) : (
                                                        mentions.map((mention, idx) => (
                                                            <div
                                                                key={`${mention.sourceNoteId}-${idx}`}
                                                                className="p-2 rounded-md bg-accent/50 hover:bg-accent transition-colors cursor-pointer"
                                                                onClick={() => onNavigate(mention.sourceNoteTitle)}
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-sm truncate flex-1">
                                                                        {mention.sourceNoteTitle}
                                                                    </span>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="text-xs shrink-0"
                                                                    >
                                                                        {mention.linkCount}×
                                                                    </Badge>
                                                                </div>
                                                                {mention.context && (
                                                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                                        {mention.context}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </CollapsibleContent>
                                        </div>
                                    </Collapsible>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

export default EntityMentionsPanel;
