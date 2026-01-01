import React, { useState } from 'react';
import { format } from 'date-fns';
import { Clock, ChevronRight, ChevronDown, Plus, ExternalLink, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NarrativeEntity } from '@/types/narrativeEntities';
import { EntityKind, ENTITY_COLORS, ENTITY_KINDS } from '@/lib/types/entityTypes';
import cx from 'classnames';

export interface TimelineCardProps {
    entity: NarrativeEntity;
    mode?: 'compact' | 'standard' | 'expanded';
    showActions?: boolean;
    showMetadata?: boolean;
    showRelationships?: boolean;
    onNavigate?: (entityId: string) => void;
    onEdit?: (entityId: string) => void;
    onQuickAdd?: (parentId: string, type: string) => void;
}

export function TimelineCard({
    entity,
    mode = 'standard',
    showActions = true,
    showMetadata = true,
    showRelationships = true,
    onNavigate,
    onEdit,
    onQuickAdd
}: TimelineCardProps) {
    const [isExpanded, setIsExpanded] = useState(mode === 'expanded');

    // Get color for border
    const borderColor = ENTITY_COLORS[entity.kind] || '#ccc';

    // Format time display
    const renderTime = () => {
        if (!entity.temporal?.start) return null;
        const pt = entity.temporal.start;

        let timeStr = pt.displayText || 'Unspecified time';
        if (pt.timestamp) {
            // Simple formatting
            timeStr = format(new Date(pt.timestamp), mode === 'compact' ? 'MMM d' : 'MMM d, yyyy h:mm a');
        }

        return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{timeStr}</span>
                {pt.confidence < 1 && (
                    <span className="text-[10px] opacity-70 italic">(approx)</span>
                )}
            </div>
        );
    };

    // Render context subtitle
    const renderSubtitle = () => {
        if (mode === 'compact') return null;

        if (entity.kind === 'SCENE') {
            const loc = entity.sceneMetadata?.location;
            const pov = entity.sceneMetadata?.povCharacterId; // ID only, would need lookup name really
            return (
                <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                    {loc && <span>📍 {loc}</span>}
                    {pov && <span>👤 POV</span>}
                    {/* Ideally we resolve POV name here provided by props or context */}
                </div>
            );
        }

        if (entity.kind === 'EVENT') {
            return (
                <div className="text-xs text-muted-foreground mt-0.5">
                    {entity.eventMetadata?.scope} • {entity.eventMetadata?.impact}
                </div>
            );
        }

        return null;
    };

    return (
        <div
            className={cn(
                "timeline-card border rounded-lg bg-card hover:shadow-sm transition-all relative overflow-hidden",
                mode === 'compact' ? "p-2" : "p-3",
                "border-l-4"
            )}
            style={{ borderLeftColor: borderColor }}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    {renderTime()}

                    <h4 className={cn("font-medium truncate mt-1", mode === 'compact' ? "text-sm" : "text-sm")}>
                        {entity.label}
                    </h4>

                    {renderSubtitle()}
                </div>

                {/* Actions */}
                {showActions && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onNavigate && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onNavigate(entity.id)}>
                                <ExternalLink className="h-3 w-3" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsExpanded(!isExpanded)}>
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </Button>
                    </div>
                )}
            </div>

            {/* Metadata Badges */}
            {showMetadata && mode !== 'compact' && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {/* Status Badge - only for entities that support it */}
                    {(entity.kind === 'ARC' || entity.kind === 'ACT' || entity.kind === 'CHAPTER') && entity.narrativeMetadata?.status && (
                        <Badge variant="secondary" className="h-4 text-[10px] px-1.5 font-normal">
                            {entity.narrativeMetadata.status}
                        </Badge>
                    )}
                    {entity.kind === 'SCENE' && entity.sceneMetadata?.status && (
                        <Badge variant="secondary" className="h-4 text-[10px] px-1.5 font-normal">
                            {entity.sceneMetadata.status}
                        </Badge>
                    )}

                    {entity.kind === 'SCENE' && entity.sceneMetadata?.purpose && (
                        <Badge variant="outline" className="h-4 text-[10px] px-1.5 font-normal">
                            {entity.sceneMetadata.purpose}
                        </Badge>
                    )}
                    {entity.kind === 'SCENE' && entity.sceneMetadata?.stakes && (
                        <Badge className={cn("h-4 text-[10px] px-1.5 font-normal",
                            entity.sceneMetadata.stakes === 'high' ? 'bg-orange-500/10 text-orange-600 border-orange-200' :
                                entity.sceneMetadata.stakes === 'critical' ? 'bg-red-500/10 text-red-600 border-red-200' : 'bg-muted'
                        )}>
                            {entity.sceneMetadata.stakes}
                        </Badge>
                    )}
                </div>
            )}

            {/* Expanded Content */}
            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-border/50 animate-in slide-in-from-top-1 fade-in duration-200">
                    {/* Summary / Description */}
                    {entity.kind === 'SCENE' && entity.sceneMetadata?.conflict && (
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                            <span className="font-semibold">Conflict:</span> {entity.sceneMetadata.conflict}
                        </p>
                    )}
                    {entity.kind === 'EVENT' && entity.eventMetadata?.description && (
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                            {entity.eventMetadata.description}
                        </p>
                    )}
                    {/* Relationships */}
                    {showRelationships && entity.linkedEntityIds?.length > 0 && (
                        <div className="mb-3">
                            <div className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Related</div>
                            <div className="flex flex-wrap gap-1">
                                {entity.linkedEntityIds.slice(0, 5).map(id => (
                                    <Badge key={id} variant="outline" className="text-[10px] h-4 font-normal bg-muted/50">
                                        {/* In real app resolved name, here ID */}
                                        Entity
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quick Actions */}
                    {onQuickAdd && (
                        <div className="flex gap-2">
                            {entity.kind === 'SCENE' && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-xs w-full justify-start px-2 bg-muted/30 hover:bg-muted"
                                    onClick={() => onQuickAdd(entity.id, 'BEAT')}
                                >
                                    <Plus className="h-3 w-3 mr-1.5" />
                                    Add Beat
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs w-full justify-start px-2 bg-muted/30 hover:bg-muted"
                                onClick={() => onQuickAdd(entity.id, 'EVENT')}
                            >
                                <Plus className="h-3 w-3 mr-1.5" />
                                Add Event
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
