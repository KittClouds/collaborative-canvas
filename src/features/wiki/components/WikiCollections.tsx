/**
 * WikiCollections Component
 * Database-style view for a specific entity category with Table/Cards/Board views.
 * Phase 2A: Rich cover banners, gallery cards with images, sub-tabs, tag badges.
 * Phase 2B: Integrated WikiPeekPanel for quick entity preview.
 */
import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    LayoutGrid,
    Table as TableIcon,
    Columns3,
    Filter,
    SortAsc,
    Search,
    User,
    Flag,
    MapPin,
    Package,
    BookOpen,
    FileText,
    Plus,
    Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useWikiData } from '../hooks/useWikiData';
import { getCategoryById, type WikiViewMode, type WikiCategory } from '../types/wikiTypes';
import { getDisplayName } from '@/lib/utils/titleParser';
import { WikiPeekPanel } from './WikiPeekPanel';
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

// Location sub-types for hierarchical filtering
const LOCATION_SUBTABS = [
    { id: 'all', label: 'All Locations' },
    { id: 'continent', label: 'Continents' },
    { id: 'country', label: 'Countries' },
    { id: 'city', label: 'Cities' },
    { id: 'district', label: 'Districts' },
];

// Character sub-types for filtering
const CHARACTER_SUBTABS = [
    { id: 'all', label: 'All' },
    { id: 'protagonist', label: 'Protagonists' },
    { id: 'antagonist', label: 'Antagonists' },
    { id: 'ally', label: 'Allies' },
    { id: 'npc', label: 'NPCs' },
];

// Get sub-tabs based on category
function getSubtabsForCategory(categoryId: string): Array<{ id: string; label: string }> | null {
    if (categoryId === 'locations') return LOCATION_SUBTABS;
    if (categoryId === 'characters') return CHARACTER_SUBTABS;
    return null;
}

// Cover image patterns (gradient-based placeholders)
const COVER_PATTERNS: Record<string, string> = {
    characters: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    factions: 'linear-gradient(135deg, #1a1a1a 0%, #2d1f1f 50%, #3d2020 100%)',
    locations: 'linear-gradient(135deg, #0a1a1a 0%, #0d2818 50%, #0f3520 100%)',
    items: 'linear-gradient(135deg, #1a1a2e 0%, #2d1a3d 50%, #3d1a50 100%)',
    lore: 'linear-gradient(135deg, #0a1a2e 0%, #0d1a3d 50%, #102850 100%)',
    chapters: 'linear-gradient(135deg, #1a1a1a 0%, #2d1a2d 50%, #401a40 100%)',
};

interface EntityRowProps {
    note: Note;
    color: string;
    onPeek?: (note: Note) => void;
}

function EntityRow({ note, color, onPeek }: EntityRowProps) {
    const displayName = getDisplayName(note.title);
    const updatedAt = note.updated_at || note.updatedAt;
    const dateStr = updatedAt ? new Date(updatedAt).toLocaleDateString() : '-';
    const subtype = note.entitySubtype || note.entity_subtype;

    const handleClick = (e: React.MouseEvent) => {
        if (onPeek) {
            e.preventDefault();
            onPeek(note);
        }
    };

    return (
        <Link
            to={`/wiki/entity/${note.id}`}
            onClick={handleClick}
            className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-accent/50 transition-colors group"
        >
            {/* Avatar */}
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                style={{ backgroundColor: `${color}20`, color }}
            >
                {displayName?.charAt(0)?.toUpperCase() || '?'}
            </div>

            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    {displayName || 'Untitled'}
                </p>
            </div>

            {/* Tags */}
            {subtype && (
                <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 shrink-0"
                    style={{ borderColor: `${color}50`, color }}
                >
                    {subtype}
                </Badge>
            )}

            <div className="text-xs text-muted-foreground shrink-0">
                {dateStr}
            </div>
        </Link>
    );
}

interface EntityCardGridProps {
    note: Note;
    color: string;
    category: WikiCategory;
    onPeek?: (note: Note) => void;
}

function EntityCardGrid({ note, color, category, onPeek }: EntityCardGridProps) {
    const displayName = getDisplayName(note.title);
    const subtype = note.entitySubtype || note.entity_subtype;
    const Icon = ICON_MAP[category.icon] || FileText;

    const handleClick = (e: React.MouseEvent) => {
        if (onPeek) {
            e.preventDefault();
            onPeek(note);
        }
    };

    return (
        <Link
            to={`/wiki/entity/${note.id}`}
            onClick={handleClick}
            className="group relative flex flex-col rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden"
        >
            {/* Cover Image Placeholder */}
            <div
                className="h-28 w-full relative overflow-hidden"
                style={{
                    background: COVER_PATTERNS[category.id] || COVER_PATTERNS.characters
                }}
            >
                {/* Decorative grid overlay */}
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: `radial-gradient(${color}40 1px, transparent 1px)`,
                        backgroundSize: '20px 20px'
                    }}
                />

                {/* Icon watermark */}
                <Icon
                    className="absolute right-3 top-3 h-8 w-8 opacity-20"
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
            <div className="px-4 -mt-6 relative z-10">
                <div
                    className="w-12 h-12 rounded-xl border-2 border-background bg-card flex items-center justify-center text-lg font-bold shadow-lg"
                    style={{ color, backgroundColor: `${color}10` }}
                >
                    {displayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
            </div>

            {/* Card Content */}
            <div className="p-4 pt-2 flex flex-col gap-2">
                <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {displayName || 'Untitled'}
                </h4>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                    {subtype && (
                        <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-muted/50"
                        >
                            {subtype}
                        </Badge>
                    )}
                </div>
            </div>
        </Link>
    );
}

export function WikiCollections() {
    const { categoryId } = useParams<{ categoryId: string }>();
    const { getByKind, getEntityById } = useWikiData();
    const [viewMode, setViewMode] = useState<WikiViewMode>('cards');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSubtab, setActiveSubtab] = useState('all');
    const [peekEntity, setPeekEntity] = useState<Note | null>(null);
    const [peekOpen, setPeekOpen] = useState(false);

    const category = getCategoryById(categoryId || '');
    const Icon = category ? (ICON_MAP[category.icon] || FileText) : FileText;
    const subtabs = categoryId ? getSubtabsForCategory(categoryId) : null;

    const notes = useMemo(() => {
        if (!category) return [];
        let result = getByKind(category.entityKind);

        // Filter by search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(n =>
                getDisplayName(n.title).toLowerCase().includes(q)
            );
        }

        // Filter by subtype if not 'all'
        if (activeSubtab !== 'all' && subtabs) {
            result = result.filter(n => {
                const subtype = (n.entitySubtype || n.entity_subtype || '').toLowerCase();
                return subtype === activeSubtab.toLowerCase();
            });
        }

        // Sort by updated_at descending
        return result.sort((a, b) =>
            (b.updated_at || b.updatedAt || 0) - (a.updated_at || a.updatedAt || 0)
        );
    }, [category, getByKind, searchQuery, activeSubtab, subtabs]);

    const handlePeek = (note: Note) => {
        setPeekEntity(note);
        setPeekOpen(true);
    };

    const handleSelectEntity = (id: string) => {
        const entity = getEntityById(id);
        if (entity) {
            setPeekEntity(entity);
        }
    };

    if (!category) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Category not found.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Rich Cover Banner */}
            <div
                className="h-40 relative shrink-0 overflow-hidden"
                style={{
                    background: COVER_PATTERNS[categoryId || 'characters']
                }}
            >
                {/* Decorative elements */}
                <div
                    className="absolute inset-0 opacity-20"
                    style={{
                        backgroundImage: `radial-gradient(${category.color}30 1px, transparent 1px)`,
                        backgroundSize: '30px 30px'
                    }}
                />

                {/* Gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

                {/* Icon watermark */}
                <Icon
                    className="absolute right-8 top-1/2 -translate-y-1/2 h-24 w-24 opacity-10"
                    style={{ color: category.color }}
                />

                {/* Title content */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-end gap-4">
                        {/* Icon badge */}
                        <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg border border-border"
                            style={{ backgroundColor: `${category.color}20` }}
                        >
                            <Icon className="h-7 w-7" style={{ color: category.color }} />
                        </div>

                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-foreground">{category.pluralLabel}</h1>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {notes.length} {notes.length === 1 ? 'entry' : 'entries'} in this collection
                            </p>
                        </div>

                        <Button className="gap-2" style={{ backgroundColor: category.color }}>
                            <Plus className="h-4 w-4" />
                            Add {category.label}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Sub-tabs (for locations, characters, etc.) */}
            {subtabs && (
                <div className="border-b border-border px-6 bg-muted/20 shrink-0">
                    <div className="flex items-center gap-1 -mb-px">
                        {subtabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveSubtab(tab.id)}
                                className={cn(
                                    "px-3 py-2.5 text-sm font-medium border-b-2 transition-colors",
                                    activeSubtab === tab.id
                                        ? "border-primary text-foreground"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="border-b border-border px-6 py-3 flex items-center gap-3 bg-background shrink-0">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={`Search ${category.pluralLabel.toLowerCase()}...`}
                        className="pl-9 h-9 bg-muted/30 border-0 focus-visible:ring-1"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5">
                        <Filter className="h-3.5 w-3.5" />
                        Filter
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5">
                        <SortAsc className="h-3.5 w-3.5" />
                        Sort
                    </Button>

                    {/* View Mode Switcher */}
                    <div className="h-8 w-px bg-border mx-1" />
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as WikiViewMode)}>
                        <TabsList className="h-8 bg-muted/30">
                            <TabsTrigger value="table" className="h-6 px-2">
                                <TableIcon className="h-3.5 w-3.5" />
                            </TabsTrigger>
                            <TabsTrigger value="cards" className="h-6 px-2">
                                <LayoutGrid className="h-3.5 w-3.5" />
                            </TabsTrigger>
                            <TabsTrigger value="board" className="h-6 px-2">
                                <Columns3 className="h-3.5 w-3.5" />
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
                {notes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div
                            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
                            style={{ backgroundColor: `${category.color}10` }}
                        >
                            <Icon className="h-10 w-10" style={{ color: `${category.color}40` }} />
                        </div>
                        <p className="text-foreground font-medium">
                            No {category.pluralLabel.toLowerCase()} found
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            {searchQuery
                                ? 'Try a different search term.'
                                : `Create entity notes with [${category.entityKind}|Name] syntax to populate this collection.`
                            }
                        </p>
                        <Button variant="outline" className="mt-4 gap-2">
                            <Plus className="h-4 w-4" />
                            Create {category.label}
                        </Button>
                    </div>
                ) : viewMode === 'table' ? (
                    <div className="divide-y divide-border">
                        {notes.map(note => (
                            <EntityRow key={note.id} note={note} color={category.color} onPeek={handlePeek} />
                        ))}
                    </div>
                ) : viewMode === 'cards' ? (
                    <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {notes.map(note => (
                            <EntityCardGrid key={note.id} note={note} color={category.color} category={category} onPeek={handlePeek} />
                        ))}
                    </div>
                ) : (
                    // Board view placeholder
                    <div className="p-6 flex flex-col items-center justify-center h-64">
                        <Columns3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground font-medium">
                            Board view coming soon
                        </p>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                            Organize {category.pluralLabel.toLowerCase()} in kanban-style columns
                        </p>
                    </div>
                )}
            </ScrollArea>

            {/* Peek Panel */}
            <WikiPeekPanel
                entity={peekEntity}
                open={peekOpen}
                onOpenChange={setPeekOpen}
                onSelectEntity={handleSelectEntity}
            />
        </div>
    );
}

export default WikiCollections;
