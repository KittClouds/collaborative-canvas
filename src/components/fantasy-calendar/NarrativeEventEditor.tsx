
"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarEvent, EditorScope } from '@/lib/fantasy-calendar/types';
import { useCalendarContext } from '@/contexts/CalendarContext';
import { useNarrativeManagement, NarrativeOption } from '@/hooks/useNarrativeManagement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { EventDetailPanel } from './EventDetailPanel';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    Search, Calendar, CalendarDays, CalendarRange, Layers,
    Circle, Clock, CheckCircle2, Plus, Filter,
    GitBranch, Zap, Pin, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getEventTypeById } from '@/lib/fantasy-calendar/eventTypeRegistry';

interface NarrativeEventEditorProps {
    className?: string;
}

// Scope icons and labels
const SCOPE_CONFIG: Record<EditorScope, { icon: React.ElementType; label: string; description: string }> = {
    day: { icon: Calendar, label: 'Day', description: 'Events for selected day' },
    week: { icon: CalendarDays, label: 'Week', description: 'Events for current week' },
    month: { icon: CalendarRange, label: 'Month', description: 'All events this month' },
    period: { icon: Layers, label: 'Period', description: 'Events in selected period' },
};

// Status configuration
const STATUS_CONFIG = {
    'todo': { label: 'To Do', icon: Circle, color: 'var(--chart-2)', bgClass: 'border-t-[var(--chart-2)]' },
    'in-progress': { label: 'In Progress', icon: Clock, color: 'var(--chart-3)', bgClass: 'border-t-[var(--chart-3)]' },
    'completed': { label: 'Completed', icon: CheckCircle2, color: 'var(--chart-1)', bgClass: 'border-t-[var(--chart-1)]' },
};

export function NarrativeEventEditor({ className }: NarrativeEventEditorProps) {
    const {
        viewDate,
        currentMonth,
        editorScope,
        setEditorScope,
        getEventsForScope,
        events,
        toggleEventStatus,
        addEvent,
    } = useCalendarContext();

    const { narrativeRoots, createNarrativeRoot, createNarrativeNode, getAvailableTypes } = useNarrativeManagement();

    // Local state
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterImportance, setFilterImportance] = useState<string>('all');
    const [showCompleted, setShowCompleted] = useState(true);
    const [sortBy, setSortBy] = useState<'title' | 'tension' | 'date'>('date');
    const [quickAddTitle, setQuickAddTitle] = useState('');
    const [quickAddColumn, setQuickAddColumn] = useState<keyof typeof STATUS_CONFIG | null>(null);

    // Active Narrative Root State
    const [activeRootId, setActiveRootId] = useState<string | null>(null);

    // Auto-select root if only one exists or none selected
    useEffect(() => {
        if (!activeRootId && narrativeRoots.length > 0) {
            setActiveRootId(narrativeRoots[0].id);
        } else if (activeRootId && !narrativeRoots.find(r => r.id === activeRootId)) {
            // Reset if active root disappeared
            if (narrativeRoots.length > 0) setActiveRootId(narrativeRoots[0].id);
            else setActiveRootId(null);
        }
    }, [narrativeRoots, activeRootId]);

    const narrativeOptions = useMemo(() => getAvailableTypes(), [getAvailableTypes]);

    // Initializer Logic
    const handleInitializeTimeline = useCallback(async () => {
        const root = await createNarrativeRoot('Narrative');
        // Effect will pick it up and set activeRootId
    }, [createNarrativeRoot]);

    // Quick add handler
    const handleQuickAdd = useCallback(async (status: keyof typeof STATUS_CONFIG, option?: NarrativeOption) => {
        if (!quickAddTitle.trim()) return;

        // Requirement: Must have an active root to create narrative files
        if (!activeRootId) {
            // Should not happen if UI is gated, but safeguard
            alert("No Active Narrative Timeline selected.");
            return;
        }

        if (option) {
            // 1. Create File/Folder Structure
            const result = await createNarrativeNode(
                activeRootId,
                quickAddTitle.trim(),
                option,
                { year: viewDate.year, month: viewDate.monthIndex + 1, day: viewDate.dayIndex + 1 }
            );

            // 2. Add Calendar Event
            const newEvent = addEvent({
                title: quickAddTitle.trim(),
                description: '',
                date: { ...viewDate },
                status: status,
                importance: 'moderate',
                showInCell: true,
                eventTypeId: result.kind === 'SCENE' ? 'scene' : 'event',
                entityId: result.id, // Link!
                entityKind: result.kind
            });

            // Optimistic selection?
            setSelectedEventId(newEvent.id);
            setQuickAddTitle('');
            setQuickAddColumn(null);
        }
    }, [quickAddTitle, viewDate, addEvent, createNarrativeNode, activeRootId]);


    // Get scoped events
    const scopedEvents = useMemo(() => getEventsForScope(), [getEventsForScope]);

    // Filter and sort events
    const filteredEvents = useMemo(() => {
        return scopedEvents
            .filter(e => {
                if (!showCompleted && e.status === 'completed') return false;
                if (filterImportance !== 'all' && e.importance !== filterImportance) return false;
                if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    return e.title.toLowerCase().includes(query) ||
                        e.description?.toLowerCase().includes(query);
                }
                return true;
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case 'title':
                        return a.title.localeCompare(b.title);
                    case 'tension':
                        return (b.tension || 0) - (a.tension || 0);
                    case 'date':
                    default:
                        return a.date.dayIndex - b.date.dayIndex;
                }
            });
    }, [scopedEvents, showCompleted, filterImportance, searchQuery, sortBy]);

    // Group by status
    const columns = useMemo(() => ({
        'todo': filteredEvents.filter(e => !e.status || e.status === 'todo'),
        'in-progress': filteredEvents.filter(e => e.status === 'in-progress'),
        'completed': filteredEvents.filter(e => e.status === 'completed'),
    }), [filteredEvents]);

    // Analytics
    const stats = useMemo(() => ({
        total: filteredEvents.length,
        completed: columns.completed.length,
        avgTension: filteredEvents.length > 0
            ? Math.round(filteredEvents.reduce((sum, e) => sum + (e.tension || 0), 0) / filteredEvents.length)
            : 0,
        withCausality: filteredEvents.filter(e => e.causedBy?.length || e.causes?.length).length,
    }), [filteredEvents, columns]);


    const selectedEvent = useMemo(() => {
        if (!selectedEventId) return null;
        return events.find(e => e.id === selectedEventId) || null;
    }, [selectedEventId, events]);

    // Scope label
    const scopeLabel = useMemo(() => {
        switch (editorScope) {
            case 'day':
                return `Day ${viewDate.dayIndex + 1}, ${currentMonth.name}`;
            case 'week':
                return `Week of Day ${viewDate.dayIndex + 1}`;
            case 'month':
                return currentMonth.name;
            case 'period':
                return 'Current Period';
        }
    }, [editorScope, viewDate, currentMonth]);

    return (
        <TooltipProvider>
            <div className={cn("bg-gradient-to-b from-background to-card border-t", className)}>
                {/* Header */}
                <motion.div
                    className="p-4 border-b"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-primary" />
                                Narrative Event Editor
                            </h2>
                            <p className="text-sm text-muted-foreground mr-2">{scopeLabel}</p>
                        </div>

                        {/* Timeline Selector (if multiple) */}
                        {narrativeRoots.length > 1 && (
                            <div className="flex items-center gap-2">
                                <Label>Timeline:</Label>
                                <Select value={activeRootId || ''} onValueChange={setActiveRootId}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {narrativeRoots.map(root => (
                                            <SelectItem key={root.id} value={root.id}>{root.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {/* If single root, maybe show its name badge? */}
                        {narrativeRoots.length === 1 && (
                            <Badge variant="outline" className="mr-auto ml-2">
                                {narrativeRoots[0].name}
                            </Badge>
                        )}


                        {/* Scope Selector */}
                        <div className="flex items-center gap-2">
                            {(Object.keys(SCOPE_CONFIG) as EditorScope[]).map(scope => {
                                const config = SCOPE_CONFIG[scope];
                                const Icon = config.icon;
                                return (
                                    <Tooltip key={scope}>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant={editorScope === scope ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setEditorScope(scope)}
                                                className="gap-1"
                                            >
                                                <Icon className="h-4 w-4" />
                                                {config.label}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{config.description}</TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 relative min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search events..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        {/* ... (Existing filters) ... */}
                        <div className="flex items-center gap-2">
                            <Switch
                                id="show-completed"
                                checked={showCompleted}
                                onCheckedChange={setShowCompleted}
                            />
                            <Label htmlFor="show-completed" className="text-sm">Show Completed</Label>
                        </div>
                    </div>
                </motion.div>

                {/* Analytics Panel */}
                {filteredEvents.length > 0 && (
                    <motion.div
                        className="px-4 py-3 border-b bg-muted/5"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                    >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Total Events */}
                            <div className="flex flex-col items-center p-3 rounded-lg bg-card border">
                                <span className="text-2xl font-bold text-primary">{stats.total}</span>
                                <span className="text-xs text-muted-foreground">Total Events</span>
                            </div>

                            {/* Completion Progress */}
                            <div className="flex flex-col items-center p-3 rounded-lg bg-card border">
                                <span className="text-2xl font-bold text-emerald-500">
                                    {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                                </span>
                                <span className="text-xs text-muted-foreground">Completed</span>
                                <Progress
                                    value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}
                                    className="h-1 w-full mt-1"
                                />
                            </div>

                            {/* Average Tension */}
                            <div className="flex flex-col items-center p-3 rounded-lg bg-card border">
                                <span className={cn(
                                    "text-2xl font-bold",
                                    stats.avgTension > 70 ? "text-red-500" :
                                        stats.avgTension > 40 ? "text-amber-500" : "text-blue-500"
                                )}>
                                    {stats.avgTension}
                                </span>
                                <span className="text-xs text-muted-foreground">Avg Tension</span>
                                <div className="w-full h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                                    <motion.div
                                        className={cn(
                                            "h-full rounded-full",
                                            stats.avgTension > 70 ? "bg-red-500" :
                                                stats.avgTension > 40 ? "bg-amber-500" : "bg-blue-500"
                                        )}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${stats.avgTension}%` }}
                                        transition={{ duration: 0.5, ease: 'easeOut' }}
                                    />
                                </div>
                            </div>

                            {/* Causal Links */}
                            <div className="flex flex-col items-center p-3 rounded-lg bg-card border">
                                <span className="text-2xl font-bold text-violet-500">
                                    {stats.withCausality}
                                </span>
                                <span className="text-xs text-muted-foreground">Causal Links</span>
                                <GitBranch className="h-4 w-4 mt-1 text-muted-foreground/50" />
                            </div>
                        </div>

                        {/* Status Distribution Mini-Chart */}
                        <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-dashed">
                            {(Object.entries(columns) as [keyof typeof STATUS_CONFIG, CalendarEvent[]][]).map(([status, statusEvents]) => {
                                const config = STATUS_CONFIG[status];
                                const percent = stats.total > 0 ? Math.round((statusEvents.length / stats.total) * 100) : 0;
                                return (
                                    <div key={status} className="flex items-center gap-2">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full"
                                            style={{ backgroundColor: config.color }}
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            {config.label}: <strong className="text-foreground">{statusEvents.length}</strong> ({percent}%)
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Kanban Board */}
                <motion.div
                    className="flex gap-4 p-4 overflow-x-auto"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    {(Object.entries(columns) as [keyof typeof STATUS_CONFIG, CalendarEvent[]][]).map(([status, statusEvents]) => {
                        const config = STATUS_CONFIG[status];
                        const Icon = config.icon;

                        return (
                            <Card
                                key={status}
                                className={cn(
                                    "flex-1 min-w-[300px] bg-card border border-border rounded-xl shadow-sm",
                                    "border-t-4",
                                    config.bgClass
                                )}
                            >
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-base font-medium flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            <Icon className="h-4 w-4" style={{ color: config.color }} />
                                            {config.label}
                                        </span>
                                        <Badge variant="secondary">{statusEvents.length}</Badge>
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="p-2">
                                    <ScrollArea className="h-[350px]">
                                        <div className="space-y-2 p-2">
                                            <AnimatePresence mode="popLayout">
                                                {statusEvents.map(event => (
                                                    <EventCard
                                                        key={event.id}
                                                        event={event}
                                                        onClick={() => setSelectedEventId(event.id)}
                                                        onStatusToggle={() => toggleEventStatus(event.id)}
                                                    />
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                    </ScrollArea>

                                    {/* Quick Add Section */}
                                    <div className="p-2 border-t mt-2">
                                        {/* State: No Root -> Initialize Button */}
                                        {narrativeRoots.length === 0 ? (
                                            <Button
                                                variant="outline"
                                                className="w-full border-dashed"
                                                onClick={handleInitializeTimeline}
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                Initialize Narrative Timeline
                                            </Button>
                                        ) : (
                                            /* Active Root -> Quick Add */
                                            quickAddColumn === status ? (
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Event title..."
                                                        value={quickAddTitle}
                                                        onChange={(e) => setQuickAddTitle(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Escape') setQuickAddColumn(null);
                                                        }}
                                                        autoFocus
                                                        className="h-8 text-sm"
                                                    />
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                className="h-8 px-2"
                                                                disabled={!quickAddTitle.trim()}
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48">
                                                            <DropdownMenuLabel>Create as...</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            {narrativeOptions.map((opt, idx) => (
                                                                <DropdownMenuItem
                                                                    key={idx}
                                                                    onClick={() => handleQuickAdd(status, opt)}
                                                                    className="gap-2 cursor-pointer"
                                                                >
                                                                    {opt.type === 'folder' ? <Layers className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                                                                    {opt.label}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full justify-start text-muted-foreground hover:text-foreground"
                                                    onClick={() => {
                                                        setQuickAddColumn(status);
                                                        setQuickAddTitle('');
                                                    }}
                                                >
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Add Event
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </motion.div>

                {/* Event Detail Sheet */}
                <Sheet
                    open={!!selectedEvent}
                    onOpenChange={(open) => {
                        if (!open) setSelectedEventId(null);
                    }}
                >
                    <SheetContent className="w-[450px] sm:w-[540px] p-0 overflow-hidden" aria-describedby={undefined}>
                        <VisuallyHidden>
                            <SheetTitle>Event Details</SheetTitle>
                        </VisuallyHidden>
                        {selectedEvent && (
                            <EventDetailPanel
                                event={selectedEvent}
                                onClose={() => setSelectedEventId(null)}
                                onEventClick={(id) => setSelectedEventId(id)}
                            />
                        )}
                    </SheetContent>
                </Sheet>
            </div>
        </TooltipProvider>
    );
}

// Re-implementing EventCard internally to be safe
interface EventCardProps {
    event: CalendarEvent;
    onClick: () => void;
    onStatusToggle: () => void;
}

const EventCard = React.forwardRef<HTMLDivElement, EventCardProps>(({ event, onClick, onStatusToggle }, ref) => {
    const eventType = event.eventTypeId ? getEventTypeById(event.eventTypeId) : null;
    const borderColor = eventType?.color || '#6366f1';
    const isCompleted = event.status === 'completed';

    return (
        <HoverCard openDelay={400} closeDelay={100}>
            <HoverCardTrigger asChild>
                <motion.div
                    ref={ref}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                        "p-3 rounded-lg bg-background border cursor-pointer transition-all mb-2",
                        "hover:shadow-md hover:border-primary/30",
                        isCompleted && "opacity-60"
                    )}
                    style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
                    onClick={onClick}
                >
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className={cn(
                            "text-sm font-medium truncate flex-1",
                            isCompleted && "line-through text-muted-foreground"
                        )}>
                            {event.title}
                        </h4>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onStatusToggle();
                            }}
                            className="shrink-0 p-1 hover:bg-muted rounded transition-colors"
                        >
                            {event.status === 'completed' ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : event.status === 'in-progress' ? (
                                <Clock className="h-4 w-4 text-amber-500" />
                            ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                        </button>
                    </div>
                </motion.div>
            </HoverCardTrigger>
            <HoverCardContent side="right" className="w-80">
                <div className="space-y-2">
                    <h4 className="font-semibold">{event.title}</h4>
                    {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3">{event.description}</p>
                    )}
                </div>
            </HoverCardContent>
        </HoverCard>
    );
});
EventCard.displayName = 'EventCard';

export default NarrativeEventEditor;
