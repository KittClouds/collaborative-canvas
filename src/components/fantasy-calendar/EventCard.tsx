/**
 * EventCard - Compact, rich event card for calendar grid
 * Minimal footprint: color border, checkbox, truncated title
 * Rich data revealed on hover via HoverCard
 */

"use client";

import React from 'react';
import { Check, Circle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { CalendarEvent } from '@/lib/fantasy-calendar/types';
import { useCalendarContext } from '@/contexts/CalendarContext';
import { getEventTypeById } from '@/lib/fantasy-calendar/eventTypeRegistry';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface EventCardProps {
    event: CalendarEvent;
    onClick?: () => void;
    compact?: boolean; // Extra compact mode for small cells
}

// Status indicator colors
const STATUS_COLORS = {
    'todo': 'bg-slate-500',
    'in-progress': 'bg-amber-500',
    'completed': 'bg-emerald-500',
};

// Tiny status icon
function StatusIcon({ status, className }: { status?: string; className?: string }) {
    switch (status) {
        case 'completed':
            return <Check className={cn("w-2.5 h-2.5 text-emerald-500", className)} />;
        case 'in-progress':
            return <Clock className={cn("w-2.5 h-2.5 text-amber-500", className)} />;
        default:
            return <Circle className={cn("w-2.5 h-2.5 text-slate-400", className)} />;
    }
}

export function EventCard({ event, onClick, compact = false }: EventCardProps) {
    const { toggleEventStatus, setHighlightedEventId } = useCalendarContext();
    const eventType = event.eventTypeId ? getEventTypeById(event.eventTypeId) : undefined;

    // Use event color, then type color, then fallback
    const borderColor = event.color || eventType?.color || '#6366f1';
    const status = event.status || 'todo';
    const isCompleted = status === 'completed';

    const handleStatusClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        toggleEventStatus(event.id);
    };

    const handleCardClick = () => {
        setHighlightedEventId(event.id);
        onClick?.();
    };

    // Calculate progress from checklist if available
    const progress = event.progress ?? (event.checklist?.length
        ? Math.round((event.checklist.filter(c => c.completed).length / event.checklist.length) * 100)
        : undefined);

    return (
        <HoverCard openDelay={300} closeDelay={100}>
            <HoverCardTrigger asChild>
                <motion.div
                    className={cn(
                        "group flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer",
                        "border-l-2 bg-card/80 hover:bg-accent/20 transition-colors",
                        isCompleted && "opacity-60"
                    )}
                    style={{ borderLeftColor: borderColor }}
                    onClick={handleCardClick}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {/* Status indicator - clickable */}
                    <button
                        onClick={handleStatusClick}
                        className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
                        title={`Status: ${status}`}
                    >
                        <StatusIcon status={status} />
                    </button>

                    {/* Title - truncated */}
                    <span className={cn(
                        "flex-1 text-[10px] leading-tight truncate",
                        isCompleted && "line-through text-muted-foreground"
                    )}>
                        {event.title}
                    </span>

                    {/* Progress indicator - tiny dot if in progress */}
                    {status === 'in-progress' && progress !== undefined && (
                        <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{
                                background: `conic-gradient(${borderColor} ${progress}%, transparent 0%)`
                            }}
                            title={`${progress}% complete`}
                        />
                    )}
                </motion.div>
            </HoverCardTrigger>

            {/* Hover reveals rich data */}
            <HoverCardContent
                side="right"
                align="start"
                className="w-56 p-3"
            >
                <div className="space-y-2">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm leading-tight">
                            {event.title}
                        </h4>
                        <Badge
                            variant={isCompleted ? "default" : "secondary"}
                            className={cn(
                                "text-[9px] px-1.5 py-0 shrink-0",
                                isCompleted && "bg-emerald-500/90"
                            )}
                        >
                            {status === 'completed' ? 'Done' : status === 'in-progress' ? 'Active' : 'Todo'}
                        </Badge>
                    </div>

                    {/* Type */}
                    {eventType && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: eventType.color }}
                            />
                            {eventType.label}
                        </div>
                    )}

                    {/* Description preview */}
                    {event.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                            {event.description}
                        </p>
                    )}

                    {/* Progress bar */}
                    {progress !== undefined && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Progress</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-1" />
                        </div>
                    )}

                    {/* Checklist summary */}
                    {event.checklist && event.checklist.length > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                            {event.checklist.filter(c => c.completed).length}/{event.checklist.length} tasks complete
                        </div>
                    )}

                    {/* Click hint */}
                    <p className="text-[9px] text-muted-foreground/60 pt-1">
                        Click to view details
                    </p>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}

export default EventCard;
