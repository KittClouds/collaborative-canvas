/**
 * CalendarSidebar - Uses CalendarContext for state
 * Includes event creation form aware of current month/year
 * Now Collapsible!
 */

import React, { useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Clock,
    Plus,
    Trash2,
    CalendarPlus,
    PanelLeftClose,
    PanelLeftOpen,
    Menu,
    Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCalendarContext } from '@/contexts/CalendarContext';
import { cn } from '@/lib/utils';
import { EventEditDialog } from './EventEditDialog';
import { EventCreator } from './EventCreator';
import { TimelineEditor } from './TimelineEditor';
import { CalendarEvent } from '@/lib/fantasy-calendar/types';
import { IMPORTANCE_COLORS } from '@/lib/fantasy-calendar/calendarEventSchema';
import { getEventTypeById } from '@/lib/fantasy-calendar/eventTypeRegistry';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Get Lucide icon by name
function getIcon(name: string): LucideIcon {
    const iconName = name.split('-').map(s =>
        s.charAt(0).toUpperCase() + s.slice(1)
    ).join('') as keyof typeof LucideIcons;
    return (LucideIcons[iconName] as LucideIcon) || LucideIcons.Calendar;
}

interface CalendarSidebarProps {
    onBackToEditor?: () => void;
}

export function CalendarSidebar({ onBackToEditor }: CalendarSidebarProps) {
    const {
        calendar,
        viewDate,
        currentMonth,
        daysInCurrentMonth,
        viewYearFormatted,
        eventsForCurrentMonth,
        navigateMonth,
        navigateYear,
        navigateDay,
        addEvent,
        removeEvent
    } = useCalendarContext();

    const [isCollapsed, setIsCollapsed] = useState(false);

    // Edit dialog state
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const handleEditEvent = (event: CalendarEvent) => {
        setEditingEvent(event);
        setIsEditDialogOpen(true);
    };

    if (isCollapsed) {
        return (
            <div className="w-16 bg-card border-r h-full flex flex-col items-center py-4 gap-4 transition-all duration-300">
                <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(false)} title="Expand Sidebar">
                    <PanelLeftOpen className="h-5 w-5" />
                </Button>

                <div className="h-px w-8 bg-border" />

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Clock className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            <p className="font-medium">Current View</p>
                            <p className="text-xs text-muted-foreground">{currentMonth.name}, {viewYearFormatted}</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="relative">
                                <Button variant="ghost" size="icon">
                                    <CalendarPlus className="h-5 w-5" />
                                </Button>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            Add Event
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="relative">
                                <Button variant="ghost" size="icon">
                                    <Menu className="h-5 w-5" />
                                    {eventsForCurrentMonth.length > 0 && (
                                        <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                                    )}
                                </Button>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            {eventsForCurrentMonth.length} Events this month
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <div className="mt-auto">
                    <Button variant="ghost" size="icon" onClick={onBackToEditor} title="Back to Editor">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-80 bg-card border-r h-full flex flex-col transition-all duration-300">

            {/* Fixed Header */}
            <div className="flex items-start justify-between p-4 pb-2 shrink-0">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight truncate w-60" title={calendar.name}>{calendar.name}</h2>
                    <p className="text-muted-foreground text-sm">
                        {calendar.months.length} months • {calendar.months.reduce((acc, m) => acc + m.days, 0)} days/year
                    </p>
                </div>
                <Button variant="ghost" size="icon" className="-mr-2 -mt-1" onClick={() => setIsCollapsed(true)}>
                    <PanelLeftClose className="h-4 w-4" />
                </Button>
            </div>

            {/* Scrollable Content Area */}
            <ScrollArea className="flex-1 px-4">
                <div className="space-y-4 pb-4">
                    {/* Current Date & Time */}
                    <Card className="bg-muted/30 border-none shadow-inner">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Current Date & Time
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">

                            {/* Year Controls */}
                            <div className="space-y-1">
                                <div className="flex items-center gap-1 bg-background rounded-md border p-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateYear('prev')}>-</Button>
                                    <div className="flex-1 text-center text-sm font-medium">
                                        {viewYearFormatted}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateYear('next')}>+</Button>
                                </div>
                                <div className="text-[10px] text-center text-muted-foreground uppercase">
                                    Year
                                </div>
                            </div>

                            {/* Month Controls */}
                            <div className="space-y-1">
                                <div className="flex items-center gap-1 bg-background rounded-md border p-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateMonth('prev')}>-</Button>
                                    <div className="flex-1 text-center text-sm font-medium truncate">
                                        {currentMonth.name}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateMonth('next')}>+</Button>
                                </div>
                                <div className="text-[10px] text-center text-muted-foreground uppercase">
                                    Month {viewDate.monthIndex + 1} of {calendar.months.length} • {daysInCurrentMonth} days
                                </div>
                            </div>

                            {/* Day Controls */}
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateDay('prev')}>-</Button>
                                    <div className="flex-1 text-center text-sm font-medium">
                                        Day {viewDate.dayIndex + 1}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigateDay('next')}>+</Button>
                                </div>
                                <div className="text-[10px] text-center text-muted-foreground uppercase">
                                    Day {viewDate.dayIndex + 1} of {daysInCurrentMonth}
                                </div>
                            </div>

                        </CardContent>
                    </Card>

                    {/* Timeline Periods Editor */}
                    <Card className="border-violet-500/20">
                        <CardContent className="pt-4">
                            <TimelineEditor />
                        </CardContent>
                    </Card>

                    {/* Add Event - Rich Creator */}
                    <Card className="border-emerald-500/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <CalendarPlus className="h-4 w-4" />
                                Add Event
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <EventCreator />
                        </CardContent>
                    </Card>

                    {/* Events This Month */}
                    <Card className="flex-1 min-h-0">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">
                                Events This Month
                                {eventsForCurrentMonth.length > 0 && (
                                    <Badge variant="secondary" className="ml-2">{eventsForCurrentMonth.length}</Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-40 px-4 pb-4">
                                {eventsForCurrentMonth.length === 0 ? (
                                    <div className="text-center text-muted-foreground text-xs py-4">
                                        No events this month
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {eventsForCurrentMonth
                                            .sort((a, b) => a.date.dayIndex - b.date.dayIndex)
                                            .map(event => {
                                                const importance = event.importance;
                                                const displayColor = event.color || (importance ? IMPORTANCE_COLORS[importance] : IMPORTANCE_COLORS.moderate);
                                                return (
                                                    <div
                                                        key={event.id}
                                                        className="flex items-center gap-2 p-2 rounded border text-sm group hover:bg-muted/50 transition-colors"
                                                        style={{ borderLeftColor: displayColor, borderLeftWidth: 3 }}
                                                    >
                                                        {event.eventTypeId ? (
                                                            (() => {
                                                                const typeDef = getEventTypeById(event.eventTypeId);
                                                                const Icon = typeDef ? getIcon(typeDef.icon) : LucideIcons.Calendar;
                                                                return <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: displayColor }} />;
                                                            })()
                                                        ) : (
                                                            <div
                                                                className="w-2 h-2 rounded-full shrink-0"
                                                                style={{ backgroundColor: displayColor }}
                                                            />
                                                        )}
                                                        <span className="text-muted-foreground text-xs shrink-0">
                                                            Day {event.date.dayIndex + 1}
                                                        </span>
                                                        <span className="flex-1 truncate">{event.title}</span>
                                                        {importance && importance !== 'moderate' && (
                                                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 capitalize">
                                                                {importance}
                                                            </Badge>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => handleEditEvent(event)}
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                                            onClick={() => removeEvent(event.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                );
                                            })
                                        }
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>

                </div>
            </ScrollArea>

            {/* Fixed Footer */}
            <div className="shrink-0 p-4 pt-2 border-t">
                <Button variant="ghost" className="w-full justify-start gap-2" size="sm" onClick={onBackToEditor}>
                    <ChevronLeft className="h-4 w-4" />
                    Back to Editor
                </Button>
            </div>

            {/* Edit Event Dialog */}
            <EventEditDialog
                event={editingEvent}
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
            />
        </div>
    );
}
