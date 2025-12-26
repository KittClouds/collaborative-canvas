import { useState, useMemo, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check, X } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ENTITY_COLORS, EntityKind } from '@/lib/entities/entityTypes';
import type { NEREntity } from '@/lib/extraction';

interface EntityCardProps {
    entity: NEREntity;
    onAccept: (entity: NEREntity, kind: string) => void;
    onDismiss: (entity: NEREntity) => void;
    entityTypes?: Array<{ entity_kind: string; color?: string; display_name: string }>;
    possibleKinds: string[];
}

export const EntityCard = memo(({ entity, onAccept, onDismiss, entityTypes, possibleKinds }: EntityCardProps) => {
    const [selectedKind, setSelectedKind] = useState<string>(possibleKinds[0]);

    // Get color for selected kind - check blueprint types first, then fallback to ENTITY_COLORS
    const getEntityColor = useCallback((kind: string): string => {
        const blueprintType = entityTypes?.find(t => t.entity_kind === kind);
        if (blueprintType?.color) return blueprintType.color;
        return ENTITY_COLORS[kind as EntityKind] || '#6b7280';
    }, [entityTypes]);

    const selectedColor = useMemo(() => getEntityColor(selectedKind), [selectedKind, getEntityColor]);

    const handleAccept = useCallback(() => {
        onAccept(entity, selectedKind);
    }, [entity, selectedKind, onAccept]);

    const handleDismiss = useCallback(() => {
        onDismiss(entity);
    }, [entity, onDismiss]);

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
                            className="flex-1 justify-between text-xs sm:text-sm"
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
                    onClick={handleAccept}
                    className="shrink-0"
                    style={{ backgroundColor: selectedColor }}
                >
                    <Check className="h-4 w-4" />
                </Button>

                {/* Dismiss Button */}
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDismiss}
                    className="shrink-0 hover:bg-destructive/10 hover:text-destructive"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.entity.word === nextProps.entity.word &&
        prevProps.entity.entity_type === nextProps.entity.entity_type &&
        prevProps.entity.score === nextProps.entity.score &&
        prevProps.possibleKinds.join(',') === nextProps.possibleKinds.join(',') &&
        prevProps.entityTypes === nextProps.entityTypes
    );
});
