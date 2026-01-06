/**
 * WikiPeekPanel Component
 * Slide-in drawer for previewing entity details without leaving the collection view.
 * Phase 2B: Property sheet with structured fields, linked entity chips, and "Open as Page" action.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    ExternalLink,
    Edit,
    X,
    User,
    Flag,
    MapPin,
    Package,
    BookOpen,
    FileText,
    Link2,
    Calendar,
    Hash,
    Tag,
    Users,
    Globe,
    Crown,
    Flame,
    Heart,
    Swords,
    Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryByKind, type WikiCategory } from '../types/wikiTypes';
import { getDisplayName } from '@/lib/utils/titleParser';
import { useWikiData } from '../hooks/useWikiData';
import type { Note } from '@/types/noteTypes';

// Icon map
const ICON_MAP: Record<string, React.ElementType> = {
    User,
    Flag,
    MapPin,
    Package,
    BookOpen,
    FileText,
};

// Property icons for different entity types
const PROPERTY_ICONS: Record<string, React.ElementType> = {
    type: Tag,
    status: Hash,
    faction: Flag,
    location: MapPin,
    allies: Users,
    enemies: Swords,
    traits: Heart,
    role: Crown,
    parent: Globe,
    ruler: Crown,
    climate: Flame,
    population: Users,
    defenses: Shield,
    created: Calendar,
};

// Cover patterns for peek panel
const COVER_PATTERNS: Record<string, string> = {
    CHARACTER: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    FACTION: 'linear-gradient(135deg, #1a1a1a 0%, #2d1f1f 50%, #3d2020 100%)',
    LOCATION: 'linear-gradient(135deg, #0a1a1a 0%, #0d2818 50%, #0f3520 100%)',
    ITEM: 'linear-gradient(135deg, #1a1a2e 0%, #2d1a3d 50%, #3d1a50 100%)',
    CONCEPT: 'linear-gradient(135deg, #0a1a2e 0%, #0d1a3d 50%, #102850 100%)',
    CHAPTER: 'linear-gradient(135deg, #1a1a1a 0%, #2d1a2d 50%, #401a40 100%)',
};

/** Property definition for structured display */
interface PropertyDefinition {
    key: string;
    label: string;
    icon: React.ElementType;
    type: 'text' | 'badge' | 'link' | 'links';
}

/** Get property definitions for an entity kind */
function getPropertyDefinitions(entityKind: string): PropertyDefinition[] {
    const base: PropertyDefinition[] = [
        { key: 'entityKind', label: 'Type', icon: Tag, type: 'badge' },
        { key: 'entitySubtype', label: 'Role', icon: Crown, type: 'badge' },
    ];

    switch (entityKind) {
        case 'CHARACTER':
            return [
                ...base,
                { key: 'faction', label: 'Faction', icon: Flag, type: 'link' },
                { key: 'location', label: 'Location', icon: MapPin, type: 'link' },
                { key: 'allies', label: 'Allies', icon: Users, type: 'links' },
                { key: 'enemies', label: 'Enemies', icon: Swords, type: 'links' },
            ];
        case 'LOCATION':
            return [
                ...base,
                { key: 'locationType', label: 'Location Type', icon: Globe, type: 'badge' },
                { key: 'parentLocation', label: 'Parent Location', icon: Globe, type: 'link' },
                { key: 'ruler', label: 'Ruler', icon: Crown, type: 'link' },
                { key: 'climate', label: 'Climate', icon: Flame, type: 'text' },
                { key: 'population', label: 'Population', icon: Users, type: 'text' },
            ];
        case 'FACTION':
            return [
                ...base,
                { key: 'leader', label: 'Leader', icon: Crown, type: 'link' },
                { key: 'headquarters', label: 'Headquarters', icon: MapPin, type: 'link' },
                { key: 'allies', label: 'Allies', icon: Shield, type: 'links' },
                { key: 'enemies', label: 'Enemies', icon: Swords, type: 'links' },
            ];
        case 'ITEM':
            return [
                ...base,
                { key: 'owner', label: 'Owner', icon: User, type: 'link' },
                { key: 'origin', label: 'Origin', icon: MapPin, type: 'link' },
            ];
        default:
            return base;
    }
}

/** Linked Entity Chip with hover preview */
interface EntityChipProps {
    entityId?: string;
    label: string;
    color?: string;
    onNavigate?: (id: string) => void;
}

function EntityChip({ entityId, label, color = '#666', onNavigate }: EntityChipProps) {
    const { getEntityById } = useWikiData();
    const entity = entityId ? getEntityById(entityId) : null;
    const displayLabel = entity ? getDisplayName(entity.title) : label;
    const category = entity?.entityKind ? getCategoryByKind(entity.entityKind) : null;
    const chipColor = category?.color || color;

    if (!entityId) {
        return (
            <span className="text-sm text-muted-foreground">Empty</span>
        );
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => onNavigate?.(entityId)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium bg-muted/50 hover:bg-muted transition-colors group"
                    >
                        <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: chipColor }}
                        />
                        <span className="truncate max-w-[120px] group-hover:text-primary transition-colors">
                            {displayLabel}
                        </span>
                        <Link2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1">
                        <p className="font-medium">{displayLabel}</p>
                        {entity?.entityKind && (
                            <p className="text-xs text-muted-foreground">{entity.entityKind}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Click to view</p>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/** Property Row Component */
interface PropertyRowProps {
    label: string;
    icon: React.ElementType;
    value: any;
    type: 'text' | 'badge' | 'link' | 'links';
    color?: string;
    onNavigateEntity?: (id: string) => void;
}

function PropertyRow({ label, icon: Icon, value, type, color, onNavigateEntity }: PropertyRowProps) {
    if (value === null || value === undefined || value === '') {
        return (
            <div className="flex items-start gap-3 py-2">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-muted/30 shrink-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-sm text-muted-foreground/50">Empty</p>
                </div>
            </div>
        );
    }

    const renderValue = () => {
        switch (type) {
            case 'badge':
                return (
                    <Badge
                        variant="secondary"
                        className="text-xs"
                        style={color ? { backgroundColor: `${color}20`, color } : undefined}
                    >
                        {value}
                    </Badge>
                );
            case 'link':
                return (
                    <EntityChip
                        entityId={typeof value === 'object' ? value.id : value}
                        label={typeof value === 'object' ? value.label : value}
                        color={color}
                        onNavigate={onNavigateEntity}
                    />
                );
            case 'links':
                const items = Array.isArray(value) ? value : [value];
                return (
                    <div className="flex flex-wrap gap-1">
                        {items.map((item, i) => (
                            <EntityChip
                                key={i}
                                entityId={typeof item === 'object' ? item.id : item}
                                label={typeof item === 'object' ? item.label : item}
                                color={color}
                                onNavigate={onNavigateEntity}
                            />
                        ))}
                    </div>
                );
            default:
                return <p className="text-sm text-foreground">{value}</p>;
        }
    };

    return (
        <div className="flex items-start gap-3 py-2">
            <div className="w-6 h-6 rounded flex items-center justify-center bg-muted/30 shrink-0">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                {renderValue()}
            </div>
        </div>
    );
}

/** Main WikiPeekPanel Component */
interface WikiPeekPanelProps {
    entity: Note | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectEntity?: (id: string) => void;
}

export function WikiPeekPanel({ entity, open, onOpenChange, onSelectEntity }: WikiPeekPanelProps) {
    const navigate = useNavigate();

    if (!entity) return null;

    const displayName = getDisplayName(entity.title);
    const category = entity.entityKind ? getCategoryByKind(entity.entityKind) : null;
    const Icon = category ? (ICON_MAP[category.icon] || FileText) : FileText;
    const propertyDefs = getPropertyDefinitions(entity.entityKind || '');
    const coverPattern = COVER_PATTERNS[entity.entityKind || 'CHARACTER'];

    const handleOpenAsPage = () => {
        onOpenChange(false);
        navigate(`/wiki/entity/${entity.id}`);
    };

    const handleNavigateEntity = (id: string) => {
        if (onSelectEntity) {
            onSelectEntity(id);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-[400px] sm:max-w-[400px] p-0 flex flex-col"
            >
                {/* Cover Header */}
                <div
                    className="h-28 relative shrink-0"
                    style={{ background: coverPattern }}
                >
                    {/* Decorative grid */}
                    <div
                        className="absolute inset-0 opacity-10"
                        style={{
                            backgroundImage: `radial-gradient(${category?.color || '#666'}40 1px, transparent 1px)`,
                            backgroundSize: '20px 20px'
                        }}
                    />

                    {/* Gradient fade */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

                    {/* Icon watermark */}
                    <Icon
                        className="absolute right-4 top-4 h-10 w-10 opacity-10"
                        style={{ color: category?.color }}
                    />
                </div>

                {/* Avatar + Title */}
                <div className="px-6 -mt-8 relative z-10">
                    <div className="flex items-end gap-3">
                        <div
                            className="w-16 h-16 rounded-xl border-2 border-background bg-card flex items-center justify-center text-xl font-bold shadow-lg"
                            style={{ color: category?.color, backgroundColor: `${category?.color}10` }}
                        >
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                            <SheetHeader className="space-y-0">
                                <SheetTitle className="text-lg truncate">{displayName}</SheetTitle>
                            </SheetHeader>
                            {category && (
                                <Badge
                                    variant="outline"
                                    className="text-[10px] mt-1"
                                    style={{ borderColor: category.color, color: category.color }}
                                >
                                    {category.label}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 flex items-center gap-2 border-b border-border">
                    <Button
                        onClick={handleOpenAsPage}
                        size="sm"
                        className="flex-1 gap-2"
                        style={category ? { backgroundColor: category.color } : undefined}
                    >
                        <ExternalLink className="h-4 w-4" />
                        Open as Page
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                        <Link to="/">
                            <Edit className="h-4 w-4" />
                            Edit
                        </Link>
                    </Button>
                </div>

                {/* Property Sheet */}
                <ScrollArea className="flex-1">
                    <div className="px-6 py-4">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Properties
                        </h4>
                        <div className="space-y-1">
                            {propertyDefs.map(def => (
                                <PropertyRow
                                    key={def.key}
                                    label={def.label}
                                    icon={def.icon}
                                    value={entity[def.key]}
                                    type={def.type}
                                    color={category?.color}
                                    onNavigateEntity={handleNavigateEntity}
                                />
                            ))}
                        </div>

                        {/* Timestamps */}
                        <Separator className="my-4" />
                        <div className="space-y-2">
                            <PropertyRow
                                label="Created"
                                icon={Calendar}
                                value={entity.created_at || entity.createdAt
                                    ? new Date(entity.created_at || entity.createdAt).toLocaleDateString()
                                    : null}
                                type="text"
                            />
                            <PropertyRow
                                label="Last Modified"
                                icon={Calendar}
                                value={entity.updated_at || entity.updatedAt
                                    ? new Date(entity.updated_at || entity.updatedAt).toLocaleDateString()
                                    : null}
                                type="text"
                            />
                        </div>

                        {/* Content Preview */}
                        {entity.content && (
                            <>
                                <Separator className="my-4" />
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    Content Preview
                                </h4>
                                <p className="text-sm text-muted-foreground line-clamp-6">
                                    {entity.content.replace(/<[^>]*>/g, '').slice(0, 300)}
                                    {entity.content.length > 300 && '...'}
                                </p>
                            </>
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}

export default WikiPeekPanel;
