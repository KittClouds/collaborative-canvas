import React, { useState } from 'react';
import {
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    format,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimelineItem } from '@/lib/timeline/timelineQueries';
import { cn } from '@/lib/utils';
import { ENTITY_COLORS } from '@/lib/entities/entityTypes';

interface CalendarViewProps {
    items: TimelineItem[];
    onNavigate: (id: string) => void;
}

export function CalendarView({ items, onNavigate }: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Group items by date string (yyyy-mm-dd)
    const itemsByDate = React.useMemo(() => {
        const map: Record<string, TimelineItem[]> = {};
        items.forEach(item => {
            if (!item.date) return;
            const key = format(item.date, 'yyyy-MM-dd');
            if (!map[key]) map[key] = [];
            map[key].push(item);
        });
        return map;
    }, [items]);

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between p-2 border-b">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold text-sm">
                    {format(currentMonth, 'MMMM yyyy')}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 border-b border-r text-xs">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="p-2 text-center text-muted-foreground bg-muted/20">
                        {d}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                {/* Pad start of month if needed - simplified, let's just stick to days of interval for now
             To align correctly I'd need to know the week day of monthStart.
             day.getDay() (0-6).
         */}
                {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                    <div key={`pad-${i}`} className="border-r border-b min-h-[80px] bg-muted/5" />
                ))}

                {days.map(day => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayItems = itemsByDate[dateKey] || [];

                    return (
                        <div
                            key={dateKey}
                            className={cn(
                                "border-r border-b p-1 min-h-[80px] hover:bg-muted/10 transition-colors flex flex-col gap-1",
                                !isSameMonth(day, currentMonth) && "text-muted-foreground bg-muted/5"
                            )}
                        >
                            <span className={cn(
                                "text-[10px] font-medium w-5 h-5 flex items-center justify-center rounded-full",
                                dayItems.length > 0 && "bg-primary text-primary-foreground",
                                isSameDay(day, new Date()) && "ring-2 ring-primary ring-offset-1"
                            )}>
                                {format(day, 'd')}
                            </span>

                            <div className="flex flex-col gap-0.5 overflow-hidden">
                                {dayItems.slice(0, 3).map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => onNavigate(item.id)}
                                        className="text-[9px] truncate px-1 rounded cursor-pointer hover:brightness-95"
                                        style={{
                                            backgroundColor: `${ENTITY_COLORS[item.entity.kind]}30`,
                                            color: ENTITY_COLORS[item.entity.kind]
                                        }}
                                    >
                                        {item.entity.label}
                                    </div>
                                ))}
                                {dayItems.length > 3 && (
                                    <span className="text-[9px] text-muted-foreground pl-1">
                                        +{dayItems.length - 3} more
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
