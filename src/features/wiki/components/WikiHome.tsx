/**
 * WikiHome Component
 * The "World Hub" dashboard with category lanes and right rail.
 * Phase 2A: Richer gallery cards with cover images, tag badges, better visual hierarchy.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
    Clock,
    Pin,
    Sparkles,
    ArrowRight,
    User,
    Flag,
    MapPin,
    Package,
    BookOpen,
    FileText,
    Eye,
    Globe,
    Clapperboard,
    Network,
    Image as ImageIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useWikiData } from '../hooks/useWikiData';
import { WIKI_CATEGORIES, type WikiCategory } from '../types/wikiTypes';
import { getDisplayName } from '@/lib/utils/titleParser';
import type { Note } from '@/types/noteTypes';

// Icon map
const ICON_MAP: Record<string, React.ElementType> = {
    User,
    Flag,
    MapPin,
    Package,
    BookOpen,
    FileText,
    Globe,
    Clapperboard,
    Network,
    Image: ImageIcon,
};

// Cover patterns for entity cards
const COVER_PATTERNS: Record<string, string> = {
    CHARACTER: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    FACTION: 'linear-gradient(135deg, #1a1a1a 0%, #2d1f1f 50%, #3d2020 100%)',
    LOCATION: 'linear-gradient(135deg, #0a1a1a 0%, #0d2818 50%, #0f3520 100%)',
    ITEM: 'linear-gradient(135deg, #1a1a2e 0%, #2d1a3d 50%, #3d1a50 100%)',
    CONCEPT: 'linear-gradient(135deg, #0a1a2e 0%, #0d1a3d 50%, #102850 100%)',
    CHAPTER: 'linear-gradient(135deg, #1a1a1a 0%, #2d1a2d 50%, #401a40 100%)',
};

interface EntityCardProps {
    note: Note;
    color: string;
    category: WikiCategory;
}

function EntityCard({ note, color, category }: EntityCardProps) {
    const displayName = getDisplayName(note.title);
    const subtype = note.entitySubtype || note.entity_subtype;
    const Icon = ICON_MAP[category.icon] || FileText;

    return (
        <Link
            to={`/wiki/entity/${note.id}`}
            className="group relative flex flex-col w-52 shrink-0 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden"
        >
            {/* Cover Image with Pattern */}
            <div
                className="h-24 w-full relative overflow-hidden"
                style={{
                    background: COVER_PATTERNS[category.entityKind] || COVER_PATTERNS.CHARACTER
                }}
            >
                {/* Decorative dots */}
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: `radial-gradient(${color}40 1px, transparent 1px)`,
                        backgroundSize: '16px 16px'
                    }}
                />

                {/* Icon watermark */}
                <Icon
                    className="absolute right-2 top-2 h-6 w-6 opacity-20"
                    style={{ color }}
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-2">
                    <span className="text-[10px] text-white/80 flex items-center gap-1">
                        <Eye className="h-3 w-3" /> View
                    </span>
                </div>
            </div>

            {/* Avatar overlapping cover */}
            <div className="px-3 -mt-5 relative z-10">
                <div
                    className="w-10 h-10 rounded-lg border-2 border-background bg-card flex items-center justify-center text-sm font-bold shadow-md"
                    style={{ color, backgroundColor: `${color}10` }}
                >
                    {displayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
            </div>

            {/* Card Content */}
            <div className="p-3 pt-1.5 flex flex-col gap-1.5">
                <h4 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {displayName || 'Untitled'}
                </h4>

                {/* Tags row */}
                <div className="flex flex-wrap gap-1">
                    {subtype && (
                        <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-4 bg-muted/50"
                        >
                            {subtype}
                        </Badge>
                    )}
                </div>
            </div>
        </Link>
    );
}

interface CategoryLaneProps {
    category: WikiCategory;
    notes: Note[];
}

function CategoryLane({ category, notes }: CategoryLaneProps) {
    const Icon = ICON_MAP[category.icon] || FileText;

    if (notes.length === 0) return null;

    return (
        <div className="space-y-3">
            {/* Lane Header */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${category.color}15` }}
                    >
                        <Icon className="h-4 w-4" style={{ color: category.color }} />
                    </div>
                    <h3 className="font-semibold text-sm">{category.pluralLabel}</h3>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                        {notes.length}
                    </Badge>
                </div>
                <Link
                    to={`/wiki/collections/${category.id}`}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors group"
                >
                    View all
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
            </div>

            {/* Horizontal Scroll Cards */}
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-3 pb-3">
                    {notes.slice(0, 10).map(note => (
                        <EntityCard key={note.id} note={note} color={category.color} category={category} />
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}

export function WikiHome() {
    const { recentlyUpdated, getByKind, getCategoryStats } = useWikiData();
    const stats = getCategoryStats();

    return (
        <div className="flex h-full overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto">
                {/* Hero Header */}
                <div className="relative h-52 overflow-hidden">
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900" />

                    {/* Decorative grid */}
                    <div
                        className="absolute inset-0 opacity-10"
                        style={{
                            backgroundImage: 'radial-gradient(#14b8a6 1px, transparent 1px)',
                            backgroundSize: '40px 40px'
                        }}
                    />

                    {/* Radial glow */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-500/20 via-transparent to-transparent" />

                    {/* Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-background via-background/80 to-transparent">
                        <h1 className="text-3xl font-bold text-foreground mb-2">Story Wiki</h1>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Explore your world's characters, locations, factions, and lore. Every entity you create becomes part of your living encyclopedia.
                        </p>
                    </div>
                </div>

                {/* Category Lanes */}
                <div className="p-6 space-y-8">
                    {WIKI_CATEGORIES.map(category => {
                        const notes = getByKind(category.entityKind);
                        return (
                            <CategoryLane
                                key={category.id}
                                category={category}
                                notes={notes}
                            />
                        );
                    })}

                    {/* Empty State */}
                    {stats.every(s => s.count === 0) && (
                        <div className="text-center py-16">
                            <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-6">
                                <Sparkles className="h-10 w-10 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-xl font-semibold text-foreground mb-2">
                                Your wiki is empty
                            </h3>
                            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                                Create entity notes using the <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">[KIND|Name]</code> syntax in the editor to populate your wiki.
                            </p>
                            <Button asChild>
                                <Link to="/">Go to Editor</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Rail */}
            <aside className="w-72 border-l border-border bg-muted/10 flex flex-col shrink-0">
                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-6">
                        {/* Now Widget */}
                        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <div className="w-6 h-6 rounded-md bg-teal-500/10 flex items-center justify-center">
                                    <Clock className="h-3.5 w-3.5 text-teal-500" />
                                </div>
                                <span>Now</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Current in-world date and narrative focus.
                            </p>
                            <Button variant="outline" size="sm" className="w-full" asChild>
                                <Link to="/calendar">Open Calendar</Link>
                            </Button>
                        </div>

                        {/* Recently Updated */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <span>Recently Updated</span>
                            </div>
                            {recentlyUpdated.length > 0 ? (
                                <div className="space-y-1">
                                    {recentlyUpdated.map(note => {
                                        const category = WIKI_CATEGORIES.find(c =>
                                            c.entityKind === (note.entityKind || note.entity_kind)
                                        );
                                        return (
                                            <Link
                                                key={note.id}
                                                to={`/wiki/entity/${note.id}`}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                            >
                                                <div
                                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                                    style={{ backgroundColor: category?.color || '#666' }}
                                                />
                                                <span className="truncate">{getDisplayName(note.title)}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground px-2">
                                    No recent updates.
                                </p>
                            )}
                        </div>

                        {/* Category Stats */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                                    <Pin className="h-3.5 w-3.5 text-amber-500" />
                                </div>
                                <span>Collections</span>
                            </div>
                            <div className="space-y-1">
                                {stats.map(({ category, count }) => {
                                    const Icon = ICON_MAP[category.icon] || FileText;
                                    return (
                                        <Link
                                            key={category.id}
                                            to={`/wiki/collections/${category.id}`}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                        >
                                            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: category.color }} />
                                            <span className="truncate flex-1">{category.pluralLabel}</span>
                                            <span className="font-mono text-xs text-muted-foreground/70">{count}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </aside>
        </div>
    );
}

export default WikiHome;
