/**
 * DayCell - Calendar day as mini-Kanban column
 * Clean, minimal design with event cards and quick-add
 */

"use client";

import React from 'react';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { CalendarEvent, FantasyDate, MoonDefinition, CalendarDefinition } from '@/lib/fantasy-calendar/types';
import { getMoonPhase } from '@/lib/fantasy-calendar/utils';
import { EventCard } from './EventCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getEventTypeById } from '@/lib/fantasy-calendar/eventTypeRegistry';

interface DayCellProps {
    dayIndex: number;           // 0-based day index in month
    date: FantasyDate;          // Full date object
    events: CalendarEvent[];    // Events for this day
    calendar: CalendarDefinition;
    isToday?: boolean;
    isHighlighted?: boolean;
    onDayClick?: () => void;
    onAddEvent?: () => void;
    onEventClick?: (eventId: string) => void;
}

export function DayCell({
    dayIndex,
    date,
    events,
    calendar,
    isToday = false,
    isHighlighted = false,
    onDayClick,
    onAddEvent,
    onEventClick,
}: DayCellProps) {
    const displayDay = dayIndex + 1;

    // Sort events: in-progress first, then todo, then completed
    const sortedEvents = [...events].sort((a, b) => {
        const order = { 'in-progress': 0, 'todo': 1, 'completed': 2, undefined: 1 };
        return (order[a.status as keyof typeof order] ?? 1) - (order[b.status as keyof typeof order] ?? 1);
    });

    // Count by status for subtle indicator
    const completedCount = events.filter(e => e.status === 'completed').length;
    const totalCount = events.length;

    const handleAddClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAddEvent?.();
    };

    return (
        <motion.div
            className={cn(
                "relative flex flex-col min-h-[100px] bg-card border-t border-l p-1.5",
                "hover:bg-accent/5 transition-colors cursor-pointer group",
                isHighlighted && "ring-1 ring-primary/50 bg-primary/5",
                isToday && "bg-primary/10"
            )}
            onClick={onDayClick}
            initial={false}
        >
            {/* Day Header - compact */}
            <div className="flex items-center justify-between mb-1 shrink-0">
                <div className="flex items-center gap-1">
                    {/* Day number */}
                    <span className={cn(
                        "text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full",
                        isToday && "bg-primary text-primary-foreground"
                    )}>
                        {displayDay}
                    </span>

                    {/* Moon phases - tiny indicators */}
                    <div className="flex gap-0.5">
                        {calendar.moons.slice(0, 2).map(moon => {
                            const phase = getMoonPhase(moon, calendar, date);
                            return (
                                <TooltipProvider key={moon.id}>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <div
                                                className="w-2 h-2 rounded-full border border-border/50"
                                                style={{
                                                    background: `linear-gradient(90deg, ${moon.color} ${phase * 100}%, transparent 0%)`
                                                }}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs">
                                            {moon.name}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            );
                        })}
                    </div>
                </div>

                {/* Quick add button - appears on hover */}
                <button
                    onClick={handleAddClick}
                    className={cn(
                        "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                        "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                    title="Add event"
                >
                    <Plus className="w-3 h-3" />
                </button>
            </div>



            {/* Events - compact stack */}
            {events.filter(e => e.showInCell !== false).length > 0 ? (
                <div className="flex-1 min-h-0 space-y-0.5 overflow-y-auto scrollbar-thin">
                    {sortedEvents
                        .filter(e => e.showInCell !== false)
                        .slice(0, 4)
                        .map(event => {
                            const eventType = event.eventTypeId ? getEventTypeById(event.eventTypeId) : undefined;
                            const displayColor = event.color || eventType?.color || '#6366f1';

                            if (event.cellDisplayMode === 'minimal') {
                                return (
                                    <TooltipProvider key={event.id}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className="h-1.5 w-full rounded-full cursor-pointer hover:brightness-110 transition-all"
                                                    style={{ backgroundColor: displayColor }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEventClick?.(event.id);
                                                    }}
                                                />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="text-xs">
                                                {event.title}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            }

                            if (event.cellDisplayMode === 'badge') {
                                return (
                                    <div
                                        key={event.id}
                                        className={cn(
                                            "text-[10px] px-1 py-0.5 rounded truncate font-medium cursor-pointer transition-colors border-l-2 pl-1.5",
                                            "bg-accent/10 hover:bg-accent/20 text-foreground/90"
                                        )}
                                        style={{ borderLeftColor: displayColor }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEventClick?.(event.id);
                                        }}
                                        title={event.title}
                                    >
                                        {event.title}
                                    </div>
                                );
                            }

                            // Default 'full' mode
                            return (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    onClick={() => onEventClick?.(event.id)}
                                    compact
                                />
                            );
                        })}

                    {/* Overflow indicator */}
                    {events.filter(e => e.showInCell !== false).length > 4 && (
                        <div className="text-[9px] text-muted-foreground text-center py-0.5">
                            +{events.filter(e => e.showInCell !== false).length - 4} more
                        </div>
                    )}
                </div>
            ) : (
                /* Empty state - very subtle */
                <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-30 transition-opacity">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                </div>
            )}

            {/* Completion indicator - subtle corner badge */}
            {totalCount > 0 && completedCount > 0 && (
                <div
                    className="absolute bottom-1 right-1 text-[8px] text-muted-foreground/60"
                    title={`${completedCount}/${totalCount} completed`}
                >
                    {completedCount}/{totalCount}
                </div>
            )}
        </motion.div>
    );
}

export default DayCell;
