/**
 * WikiWorldbuilding Component
 * Metadata and quick facts about your world, organized by category.
 * Phase 2C: Entity-scoped view - shows character-specific worldbuilding when entity is focused.
 * 
 * NOT a prompt system - this is where you add supplementary information
 * that doesn't warrant full notes.
 */
import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import {
    Globe,
    Mountain,
    Users,
    Sparkles,
    BookOpen,
    Crown,
    Wand2,
    ChevronRight,
    Plus,
    User,
    X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { hasEntityFocusAtom, focusedEntityLabelAtom, focusedEntityIdAtom } from '@/atoms/narrative-focus';

interface WorldbuildingCategory {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    factCount: number;
}

const WORLDBUILDING_CATEGORIES: WorldbuildingCategory[] = [
    {
        id: 'overview',
        title: 'World Overview',
        description: 'Essential characteristics and foundation of your world.',
        icon: Globe,
        color: '#06b6d4',
        factCount: 0
    },
    {
        id: 'geography',
        title: 'Geography and Ecosystems',
        description: 'Physical layout, natural resources, and environments.',
        icon: Mountain,
        color: '#10b981',
        factCount: 0
    },
    {
        id: 'cultures',
        title: 'Cultures and Societies',
        description: 'Social, political, and cultural makeup.',
        icon: Users,
        color: '#f59e0b',
        factCount: 0
    },
    {
        id: 'magic',
        title: 'Magic and Technology',
        description: 'Systems of power and their costs.',
        icon: Wand2,
        color: '#8b5cf6',
        factCount: 0
    },
    {
        id: 'religion',
        title: 'Religion and Mythology',
        description: 'Gods, myths, and faith.',
        icon: Sparkles,
        color: '#ec4899',
        factCount: 0
    },
    {
        id: 'politics',
        title: 'Politics and Power',
        description: 'Governments, rulers, and conflicts.',
        icon: Crown,
        color: '#ef4444',
        factCount: 0
    },
    {
        id: 'art',
        title: 'Art and Entertainment',
        description: 'Creative expression in your world.',
        icon: BookOpen,
        color: '#3b82f6',
        factCount: 0
    },
];

interface CategoryCardProps {
    category: WorldbuildingCategory;
    entityLabel?: string;
    onClick: () => void;
}

function CategoryCard({ category, entityLabel, onClick }: CategoryCardProps) {
    const Icon = category.icon;

    return (
        <button
            onClick={onClick}
            className="group flex flex-col p-5 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-200 text-left"
        >
            <div className="flex items-start justify-between mb-3">
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${category.color}15` }}
                >
                    <Icon className="h-5 w-5" style={{ color: category.color }} />
                </div>
                {category.factCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                        {category.factCount} fact{category.factCount !== 1 ? 's' : ''}
                    </Badge>
                )}
            </div>

            <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors mb-1">
                {category.title}
            </h3>

            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                {entityLabel
                    ? `${entityLabel}'s ${category.description.toLowerCase()}`
                    : category.description
                }
            </p>

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground">
                    {category.factCount === 0 ? 'Add facts' : 'View all'}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
        </button>
    );
}

export function WikiWorldbuilding() {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Entity scope awareness
    const hasEntityFocus = useAtomValue(hasEntityFocusAtom);
    const focusedEntityLabel = useAtomValue(focusedEntityLabelAtom);
    const focusedEntityId = useAtomValue(focusedEntityIdAtom);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="relative h-40 shrink-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-900 via-slate-900 to-slate-800" />
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)',
                        backgroundSize: '30px 30px'
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-end justify-between">
                        <div className="flex items-end gap-4">
                            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                                <Globe className="h-6 w-6 text-cyan-500" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">Worldbuilding</h1>
                                <p className="text-sm text-muted-foreground">
                                    {hasEntityFocus
                                        ? `Facts and metadata for ${focusedEntityLabel}`
                                        : 'Quick facts and metadata about your world'
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Scope indicator */}
                        {hasEntityFocus && (
                            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-cyan-500/50 text-cyan-400">
                                <User className="h-3.5 w-3.5" />
                                {focusedEntityLabel}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            {/* Scope Banner */}
            {hasEntityFocus && (
                <div className="px-6 py-3 bg-cyan-500/10 border-b border-cyan-500/20 flex items-center gap-3">
                    <span className="text-sm text-cyan-400">
                        Viewing worldbuilding scoped to <strong>{focusedEntityLabel}</strong>
                    </span>
                    <span className="text-xs text-muted-foreground">
                        • Clear entity focus to see all worldbuilding
                    </span>
                </div>
            )}

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="p-6">
                    {/* Category Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {WORLDBUILDING_CATEGORIES.map(category => (
                            <CategoryCard
                                key={category.id}
                                category={category}
                                entityLabel={hasEntityFocus ? focusedEntityLabel ?? undefined : undefined}
                                onClick={() => {
                                    setSelectedCategory(category.id);
                                    toast.info('Coming Soon', {
                                        description: `${category.title} facts will be editable once data models are finalized.`,
                                    });
                                }}
                            />
                        ))}
                    </div>

                    {/* Info Box */}
                    <div className="mt-8 p-4 rounded-xl border border-border bg-muted/30">
                        <h4 className="font-medium text-sm mb-2">What goes here?</h4>
                        <p className="text-xs text-muted-foreground">
                            Worldbuilding is for quick facts and metadata that don't need full notes.
                            {hasEntityFocus && (
                                <span className="text-cyan-400">
                                    {' '}Currently showing only facts relevant to {focusedEntityLabel}.
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}

export default WikiWorldbuilding;
