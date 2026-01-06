/**
 * WikiTimelines Component
 * Displays calendar events in a vertical timeline format.
 * Phase 2C: Entity-scoped view - shows character-specific events when entity is focused.
 */
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import {
    Clock,
    ChevronDown,
    ChevronRight,
    Calendar,
    MapPin,
    User,
    Package,
    ExternalLink,
    Plus,
    Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useTimelineEvents, type TimelineYear } from '../hooks/useTimelineEvents';
import { CalendarProvider } from '@/contexts/CalendarContext';
import { hasEntityFocusAtom, focusedEntityLabelAtom, focusedEntityIdAtom } from '@/atoms/narrative-focus';
import type { CalendarEvent } from '@/lib/fantasy-calendar/types';

// Status colors
const STATUS_COLORS: Record<string, string> = {
    'todo': '#71717a',
    'in-progress': '#f59e0b',
    'completed': '#10b981',
};

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
    'battle': '#ef4444',
    'political': '#8b5cf6',
    'personal': '#3b82f6',
    'discovery': '#06b6d4',
    'ceremony': '#ec4899',
    'trade': '#f59e0b',
    'default': '#71717a',
};

interface TimelineEventCardProps {
    event: CalendarEvent;
    monthNames?: string[];
}

function TimelineEventCard({ event, monthNames = [] }: TimelineEventCardProps) {
    const navigate = useNavigate();
    const monthName = monthNames[event.date.monthIndex] || `Month ${event.date.monthIndex + 1}`;
    const dayDisplay = `${monthName} ${event.date.dayIndex + 1}`;
    const categoryColor = CATEGORY_COLORS[event.category || 'default'] || CATEGORY_COLORS.default;
    const statusColor = STATUS_COLORS[event.status || 'todo'];

    const handleOpenInCalendar = () => {
        navigate('/calendar');
    };

    return (
        <div className="group relative flex gap-4 pb-6">
            {/* Timeline connector */}
            <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border group-last:hidden" />

            {/* Dot */}
            <div
                className="relative z-10 w-6 h-6 rounded-full border-2 border-background flex items-center justify-center shrink-0"
                style={{ backgroundColor: categoryColor }}
            >
                <div className="w-2 h-2 rounded-full bg-white/50" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 -mt-0.5">
                {/* Date badge */}
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">{dayDisplay}</span>
                    {event.status && (
                        <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-4"
                            style={{ borderColor: statusColor, color: statusColor }}
                        >
                            {event.status}
                        </Badge>
                    )}
                </div>

                {/* Event card */}
                <div className="p-3 rounded-lg border border-border bg-card/50 hover:bg-card hover:border-primary/30 transition-all">
                    <h4 className="font-medium text-sm text-foreground mb-1">
                        {event.title}
                    </h4>

                    {event.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {event.description}
                        </p>
                    )}

                    {/* Participants/Locations */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {event.participants?.slice(0, 3).map((p, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                                <User className="h-2.5 w-2.5" />
                                {p.label || p.id}
                            </Badge>
                        ))}
                        {event.locations?.slice(0, 2).map((l, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                                <MapPin className="h-2.5 w-2.5" />
                                {l.label || l.id}
                            </Badge>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1"
                            onClick={handleOpenInCalendar}
                        >
                            <Calendar className="h-3 w-3" />
                            Open in Calendar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface TimelineYearSectionProps {
    yearData: TimelineYear;
    monthNames?: string[];
    defaultOpen?: boolean;
}

function TimelineYearSection({ yearData, monthNames = [], defaultOpen = true }: TimelineYearSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-1 hover:bg-accent/50 rounded-lg transition-colors">
                {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-semibold text-sm">{yearData.formattedYear}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {yearData.events.length} event{yearData.events.length !== 1 ? 's' : ''}
                </Badge>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="pl-4 pt-2">
                    {yearData.events.map(event => (
                        <TimelineEventCard
                            key={event.id}
                            event={event}
                            monthNames={monthNames}
                        />
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

function WikiTimelinesContent() {
    const { years, totalCount, allEvents } = useTimelineEvents();
    const navigate = useNavigate();

    // Entity scope awareness
    const hasEntityFocus = useAtomValue(hasEntityFocusAtom);
    const focusedEntityLabel = useAtomValue(focusedEntityLabelAtom);
    const focusedEntityId = useAtomValue(focusedEntityIdAtom);

    // Filter events by focused entity if one is selected
    const filteredYears = useMemo(() => {
        if (!hasEntityFocus || !focusedEntityId) return years;

        return years.map(yearData => ({
            ...yearData,
            events: yearData.events.filter(event =>
                event.participants?.some(p => p.id === focusedEntityId) ||
                event.locations?.some(l => l.id === focusedEntityId) ||
                event.artifacts?.some(a => a.id === focusedEntityId)
            )
        })).filter(yearData => yearData.events.length > 0);
    }, [years, hasEntityFocus, focusedEntityId]);

    const filteredCount = filteredYears.reduce((acc, y) => acc + y.events.length, 0);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="relative h-40 shrink-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-900 via-slate-900 to-slate-800" />
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: 'radial-gradient(#14b8a6 1px, transparent 1px)',
                        backgroundSize: '30px 30px'
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-end justify-between">
                        <div className="flex items-end gap-4">
                            <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                <Clock className="h-6 w-6 text-teal-500" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">Timelines</h1>
                                <p className="text-sm text-muted-foreground">
                                    {hasEntityFocus
                                        ? `${filteredCount} event${filteredCount !== 1 ? 's' : ''} involving ${focusedEntityLabel}`
                                        : `${totalCount} event${totalCount !== 1 ? 's' : ''} from your Fantasy Calendar`
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {hasEntityFocus && (
                                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-teal-500/50 text-teal-400">
                                    <User className="h-3.5 w-3.5" />
                                    {focusedEntityLabel}
                                </Badge>
                            )}
                            <Button
                                className="gap-2 bg-teal-600 hover:bg-teal-700"
                                onClick={() => navigate('/calendar')}
                            >
                                <ExternalLink className="h-4 w-4" />
                                Open Calendar
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scope Banner */}
            {hasEntityFocus && (
                <div className="px-6 py-3 bg-teal-500/10 border-b border-teal-500/20 flex items-center gap-3">
                    <span className="text-sm text-teal-400">
                        Showing events involving <strong>{focusedEntityLabel}</strong>
                    </span>
                    <span className="text-xs text-muted-foreground">
                        • Clear entity focus to see all timeline events
                    </span>
                </div>
            )}

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="p-6">
                    {filteredYears.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-20 h-20 rounded-2xl bg-teal-500/10 flex items-center justify-center mb-6">
                                <Clock className="h-10 w-10 text-teal-500/40" />
                            </div>
                            <h2 className="text-xl font-semibold text-foreground mb-2">
                                {hasEntityFocus ? `No events for ${focusedEntityLabel}` : 'No events yet'}
                            </h2>
                            <p className="text-sm text-muted-foreground max-w-sm mb-6">
                                {hasEntityFocus
                                    ? `Create events in the Fantasy Calendar and tag ${focusedEntityLabel} as a participant.`
                                    : 'Create events in your Fantasy Calendar to see them here as a timeline.'
                                }
                            </p>
                            <Button onClick={() => navigate('/calendar')} className="gap-2">
                                <Plus className="h-4 w-4" />
                                Create Event
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredYears.map((yearData, index) => (
                                <TimelineYearSection
                                    key={yearData.year}
                                    yearData={yearData}
                                    defaultOpen={index < 3}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

// Wrapper with CalendarProvider
export function WikiTimelines() {
    return (
        <CalendarProvider>
            <WikiTimelinesContent />
        </CalendarProvider>
    );
}

export default WikiTimelines;
