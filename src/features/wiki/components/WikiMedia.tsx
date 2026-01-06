/**
 * WikiMedia Component
 * Media Gallery aggregating images from all notes.
 * Phase 2C: Masonry grid with metadata cards and entity scope awareness.
 */
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import {
    Image as ImageIcon,
    Search,
    X,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    FileText,
    User,
    Calendar,
    Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useMediaAggregator, type MediaItem } from '../hooks/useMediaAggregator';
import { WIKI_CATEGORIES, getCategoryByKind } from '../types/wikiTypes';
import { hasEntityFocusAtom, focusedEntityLabelAtom, focusedEntityIdAtom } from '@/atoms/narrative-focus';

interface MediaCardProps {
    item: MediaItem;
    onClick: () => void;
}

function MediaCard({ item, onClick }: MediaCardProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    if (hasError) {
        return null;
    }

    return (
        <button
            onClick={onClick}
            className="group relative w-full overflow-hidden rounded-lg border border-border bg-card/50 hover:border-primary/30 hover:shadow-lg transition-all break-inside-avoid mb-4"
        >
            <div className="relative">
                {!isLoaded && (
                    <div className="absolute inset-0 bg-muted animate-pulse min-h-[120px]" />
                )}
                <img
                    src={item.src}
                    alt={item.alt || item.noteTitle}
                    className={cn(
                        "w-full h-auto transition-opacity duration-300",
                        isLoaded ? "opacity-100" : "opacity-0"
                    )}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setHasError(true)}
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-sm font-medium text-white truncate">
                            {item.noteTitle}
                        </p>
                        {item.entityKind && (
                            <Badge
                                variant="secondary"
                                className="text-[10px] mt-1"
                                style={item.color ? { backgroundColor: `${item.color}30`, color: item.color } : undefined}
                            >
                                {item.entityKind}
                            </Badge>
                        )}
                    </div>

                    {/* Zoom icon */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <ZoomIn className="h-8 w-8 text-white/80" />
                    </div>
                </div>
            </div>
        </button>
    );
}

interface MediaLightboxProps {
    item: MediaItem | null;
    items: MediaItem[];
    onClose: () => void;
    onNavigate: (direction: 'prev' | 'next') => void;
}

function MediaLightbox({ item, items, onClose, onNavigate }: MediaLightboxProps) {
    if (!item) return null;

    const currentIndex = items.findIndex(i => i.id === item.id);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < items.length - 1;
    const category = item.entityKind ? getCategoryByKind(item.entityKind) : null;

    return (
        <Dialog open={!!item} onOpenChange={() => onClose()}>
            <DialogContent className="max-w-5xl p-0 bg-black/95 border-none overflow-hidden">
                <div className="flex h-[80vh]">
                    {/* Image Area */}
                    <div className="flex-1 relative flex items-center justify-center bg-black">
                        {/* Close button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-4 z-10 text-white hover:bg-white/10"
                            onClick={onClose}
                        >
                            <X className="h-5 w-5" />
                        </Button>

                        {/* Navigation */}
                        {hasPrev && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/10 h-12 w-12"
                                onClick={() => onNavigate('prev')}
                            >
                                <ChevronLeft className="h-8 w-8" />
                            </Button>
                        )}
                        {hasNext && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/10 h-12 w-12"
                                onClick={() => onNavigate('next')}
                            >
                                <ChevronRight className="h-8 w-8" />
                            </Button>
                        )}

                        {/* Image */}
                        <img
                            src={item.src}
                            alt={item.alt || item.noteTitle}
                            className="max-w-full max-h-full object-contain p-8"
                        />

                        {/* Position indicator */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full">
                            <span className="text-white/80 text-sm">
                                {currentIndex + 1} / {items.length}
                            </span>
                        </div>
                    </div>

                    {/* Metadata Panel */}
                    <div className="w-80 bg-card border-l border-border flex flex-col shrink-0">
                        <div className="p-4 border-b border-border">
                            <h3 className="font-semibold text-foreground">Image Details</h3>
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            <div className="space-y-4">
                                {/* Note Info */}
                                <div>
                                    <label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                        <FileText className="h-3 w-3" />
                                        Source Note
                                    </label>
                                    <p className="text-sm font-medium">{item.noteTitle}</p>
                                </div>

                                {/* Entity Type */}
                                {item.entityKind && (
                                    <div>
                                        <label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                            <Tag className="h-3 w-3" />
                                            Entity Type
                                        </label>
                                        <Badge
                                            variant="secondary"
                                            style={category ? { backgroundColor: `${category.color}20`, color: category.color } : undefined}
                                        >
                                            {item.entityKind}
                                        </Badge>
                                    </div>
                                )}

                                {/* Alt Text */}
                                {item.alt && (
                                    <div>
                                        <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                                            Alt Text
                                        </label>
                                        <p className="text-sm text-muted-foreground">{item.alt}</p>
                                    </div>
                                )}

                                <Separator />

                                {/* Actions */}
                                <div className="space-y-2">
                                    <Link to={`/wiki/entity/${item.noteId}`} className="block">
                                        <Button variant="outline" className="w-full justify-start gap-2">
                                            <ExternalLink className="h-4 w-4" />
                                            View Source Note
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function WikiMedia() {
    const { items, totalCount, byKind } = useMediaAggregator();
    const [searchQuery, setSearchQuery] = useState('');
    const [kindFilter, setKindFilter] = useState<string>('all');
    const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

    // Entity scope awareness
    const hasEntityFocus = useAtomValue(hasEntityFocusAtom);
    const focusedEntityLabel = useAtomValue(focusedEntityLabelAtom);
    const focusedEntityId = useAtomValue(focusedEntityIdAtom);

    // Filter items
    const filteredItems = useMemo(() => {
        let result = items;

        // Filter by focused entity
        if (hasEntityFocus && focusedEntityId) {
            result = result.filter(item => item.noteId === focusedEntityId);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(item =>
                item.noteTitle.toLowerCase().includes(q) ||
                (item.alt && item.alt.toLowerCase().includes(q))
            );
        }

        if (kindFilter !== 'all') {
            result = result.filter(item => item.entityKind === kindFilter);
        }

        return result;
    }, [items, searchQuery, kindFilter, hasEntityFocus, focusedEntityId]);

    const handleNavigate = (direction: 'prev' | 'next') => {
        if (!selectedItem) return;
        const currentIndex = filteredItems.findIndex(i => i.id === selectedItem.id);
        if (direction === 'prev' && currentIndex > 0) {
            setSelectedItem(filteredItems[currentIndex - 1]);
        } else if (direction === 'next' && currentIndex < filteredItems.length - 1) {
            setSelectedItem(filteredItems[currentIndex + 1]);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="relative h-40 shrink-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-900" />
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)',
                        backgroundSize: '30px 30px'
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-end justify-between">
                        <div className="flex items-end gap-4">
                            <div className="w-12 h-12 rounded-xl bg-slate-500/20 flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-slate-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">Media Gallery</h1>
                                <p className="text-sm text-muted-foreground">
                                    {hasEntityFocus
                                        ? `${filteredItems.length} image${filteredItems.length !== 1 ? 's' : ''} from ${focusedEntityLabel}`
                                        : `${totalCount} image${totalCount !== 1 ? 's' : ''} from your notes`
                                    }
                                </p>
                            </div>
                        </div>

                        {hasEntityFocus && (
                            <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-slate-500/50 text-slate-400">
                                <User className="h-3.5 w-3.5" />
                                {focusedEntityLabel}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            {/* Scope Banner */}
            {hasEntityFocus && (
                <div className="px-6 py-3 bg-slate-500/10 border-b border-slate-500/20 flex items-center gap-3">
                    <span className="text-sm text-slate-400">
                        Showing images from <strong>{focusedEntityLabel}</strong>'s note
                    </span>
                    <span className="text-xs text-muted-foreground">
                        • Clear entity focus to see all media
                    </span>
                </div>
            )}

            {/* Filter Bar */}
            <div className="border-b border-border px-6 py-3 flex items-center gap-3 bg-muted/20">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search images..."
                        className="pl-9 h-9 bg-background"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <Select value={kindFilter} onValueChange={setKindFilter}>
                    <SelectTrigger className="w-[160px] h-9">
                        <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {WIKI_CATEGORIES.map(cat => (
                            <SelectItem key={cat.id} value={cat.entityKind}>
                                {cat.pluralLabel}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Badge variant="secondary" className="ml-auto">
                    {filteredItems.length} image{filteredItems.length !== 1 ? 's' : ''}
                </Badge>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-20 h-20 rounded-2xl bg-slate-500/10 flex items-center justify-center mb-6">
                            <ImageIcon className="h-10 w-10 text-slate-500/40" />
                        </div>
                        <h2 className="text-xl font-semibold text-foreground mb-2">
                            {totalCount === 0
                                ? 'No images yet'
                                : hasEntityFocus
                                    ? `No images for ${focusedEntityLabel}`
                                    : 'No matches found'
                            }
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-sm mb-6">
                            {totalCount === 0
                                ? 'Add images to your notes to see them here.'
                                : hasEntityFocus
                                    ? `Add images to ${focusedEntityLabel}'s note to see them here.`
                                    : 'Try a different search term or filter.'}
                        </p>
                    </div>
                ) : (
                    <div
                        className="p-6"
                        style={{
                            columnCount: 4,
                            columnGap: '1rem'
                        }}
                    >
                        {filteredItems.map(item => (
                            <MediaCard
                                key={item.id}
                                item={item}
                                onClick={() => setSelectedItem(item)}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Lightbox with Metadata */}
            <MediaLightbox
                item={selectedItem}
                items={filteredItems}
                onClose={() => setSelectedItem(null)}
                onNavigate={handleNavigate}
            />
        </div>
    );
}

export default WikiMedia;
