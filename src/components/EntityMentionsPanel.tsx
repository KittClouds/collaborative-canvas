import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ChevronDown, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ENTITY_COLORS, EntityKind } from '@/lib/types/entityTypes';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { BacklinkInfo } from '@/lib/linking/LinkIndex';

interface EntityStats {
    entityKind: EntityKind;
    entityLabel: string;
    mentionsInThisNote: number;
    mentionsAcrossVault: number;
    appearanceCount: number;
}

interface EntityMentionsPanelProps {
    entityStats: EntityStats[];
    getEntityMentions: (label: string, kind?: EntityKind) => BacklinkInfo[];
    onNavigate: (title: string) => void;
}


export function EntityMentionsPanel({
    entityStats,
    getEntityMentions,
    onNavigate,
}: EntityMentionsPanelProps) {
    const [expandedEntities, setExpandedEntities] = useState<Set<string>>(
        new Set()
    );

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

                                return (
                                    <Collapsible
                                        key={reactKey}
                                        open={isExpanded}
                                        onOpenChange={() => toggleEntity(entityKey)}
                                    >
                                        <div className="rounded-md border bg-card">
                                            <CollapsibleTrigger className="w-full p-3 hover:bg-accent transition-colors text-left">
                                                <div className="flex items-center gap-2">
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
                                                    <div className="flex gap-2 shrink-0">
                                                        <Badge variant="secondary" className="text-xs">
                                                            {entity.appearanceCount} notes
                                                        </Badge>
                                                        <Badge variant="outline" className="text-xs">
                                                            {entity.mentionsAcrossVault} mentions
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </CollapsibleTrigger>
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
