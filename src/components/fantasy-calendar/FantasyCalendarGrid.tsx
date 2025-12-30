
import React from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Settings2,
    Moon,
    Cloud
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalendarDefinition, FantasyDate, CalendarEvent } from '@/lib/fantasy-calendar/types';
import {
    getDaysInMonth,
    getWeekdayIndex,
    getMoonPhase,
    formatFantasyDate
} from '@/lib/fantasy-calendar/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DayCell } from './DayCell';

interface FantasyCalendarGridProps {
    calendar: CalendarDefinition;
    viewDate: FantasyDate;
    events: CalendarEvent[];
    onNavigateMonth: (dir: 'prev' | 'next') => void;
    onNavigateYear: (dir: 'prev' | 'next') => void;
    onAddEvent: (date: FantasyDate) => void;
    onDayClick?: (date: FantasyDate) => void;
    onEventClick?: (id: string) => void;
}

export function FantasyCalendarGrid({
    calendar,
    viewDate,
    events,
    onNavigateMonth,
    onNavigateYear,
    onAddEvent,
    onDayClick,
    onEventClick
}: FantasyCalendarGridProps) {

    const currentMonth = calendar.months[viewDate.monthIndex];
    const era = calendar.eras.find(e => e.id === calendar.defaultEraId);
    const daysInMonth = getDaysInMonth(currentMonth, viewDate.year);

    // Calculate starting offset
    const firstDayOfWeek = getWeekdayIndex(calendar, {
        ...viewDate,
        dayIndex: 0 // First day of current month
    });

    // Generate grid cells
    const totalSlots = Math.ceil((daysInMonth + firstDayOfWeek) / calendar.weekdays.length) * calendar.weekdays.length;

    return (
        <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden shadow-sm">

            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-card border-b shrink-0">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onNavigateYear('prev')}>
                        &lt; Year
                    </Button>
                </div>

                <div className="flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">{calendar.name}</span>
                    <h2 className="text-xl font-semibold tracking-tight">
                        Year {viewDate.year} {era ? `- ${era.name}` : ''}
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onNavigateYear('next')}>
                        Year &gt;
                    </Button>
                </div>
            </div>

            {/* Scrollable Grid Container */}
            <div className="flex-1 overflow-auto">
                <div className="min-w-[800px] h-full flex flex-col">
                    {/* Month Navigation & Grid Header */}
                    <div className="bg-muted/30 p-2 text-center border-b font-medium shrink-0">
                        <div className="flex items-center justify-center gap-4 mb-2">
                            <Button variant="ghost" size="icon" onClick={() => onNavigateMonth('prev')}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-lg w-48">
                                {currentMonth.name} - Month {currentMonth.index + 1}
                            </span>
                            <Button variant="ghost" size="icon" onClick={() => onNavigateMonth('next')}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <div
                            className="grid gap-1"
                            style={{
                                gridTemplateColumns: `repeat(${calendar.weekdays.length}, minmax(0, 1fr))`
                            }}
                        >
                            {calendar.weekdays.map(day => (
                                <div key={day.id} className="p-2 text-sm text-muted-foreground font-medium uppercase tracking-wider truncate">
                                    {day.name}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Calendar Grid - Dynamic columns based on weekday count */}
                    <div
                        className="grid flex-1 bg-muted/20 gap-px border-b"
                        style={{
                            gridTemplateColumns: `repeat(${calendar.weekdays.length}, minmax(120px, 1fr))`, // Min 120px width
                            gridAutoRows: 'minmax(120px, 1fr)'
                        }}
                    >

                        {/* Empty slots before start of month */}
                        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                            <div key={`empty-${i}`} className="bg-card/50 min-h-[120px]" />
                        ))}

                        {/* Days - Smart Kanban Cells */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const dayIndex = i;
                            const currentDate: FantasyDate = { ...viewDate, dayIndex };
                            const dayEvents = events.filter(e =>
                                e.date.year === viewDate.year &&
                                e.date.monthIndex === viewDate.monthIndex &&
                                e.date.dayIndex === dayIndex
                            );

                            // Highlight if this is the selected day
                            const isSelectedDay = viewDate.dayIndex === dayIndex;

                            return (
                                <DayCell
                                    key={`day-${i}`}
                                    dayIndex={dayIndex}
                                    date={currentDate}
                                    events={dayEvents}
                                    calendar={calendar}
                                    isToday={false}
                                    isHighlighted={isSelectedDay}
                                    onDayClick={() => onDayClick?.(currentDate)}
                                    onAddEvent={() => onAddEvent(currentDate)}
                                    onEventClick={onEventClick}
                                />
                            );
                        })}

                        {/* Empty slots after end of month */}
                        {Array.from({ length: totalSlots - (daysInMonth + firstDayOfWeek) }).map((_, i) => (
                            <div key={`empty-end-${i}`} className="bg-card/50 min-h-[120px]" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
