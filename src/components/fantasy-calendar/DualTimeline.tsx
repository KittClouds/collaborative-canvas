/**
 * DualTimeline - Two synced horizontal timeline tracks
 * Track A: Periods/Years (top)
 * Track B: Individual Events (bottom)
 */

"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCalendarContext } from '@/contexts/CalendarContext';
import { useTimelineSync, TimelineItem } from './useTimelineSync';
import { getEventTypeById } from '@/lib/fantasy-calendar/eventTypeRegistry';
import { cn } from '@/lib/utils';

// Get Lucide icon by name
function getIcon(name: string): LucideIcon {
    const iconName = name.split('-').map(s =>
        s.charAt(0).toUpperCase() + s.slice(1)
    ).join('') as keyof typeof LucideIcons;
    return (LucideIcons[iconName] as LucideIcon) || LucideIcons.Calendar;
}

export type TimeScale = 'month' | 'year' | 'decade' | 'century';

interface DualTimelineProps {
    className?: string;
    scale: TimeScale;
}

// Narrow expandable card component
function TimelineCard({
    item,
    isActive,
    isExpanded,
    onToggle,
    onClick,
}: {
    item: TimelineItem;
    isActive: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    onClick: () => void;
}) {
    const eventType = item.icon ? getEventTypeById(item.icon) : undefined;
    const Icon = eventType?.icon ? getIcon(eventType.icon) : Calendar;
    const cardColor = item.color || eventType?.color || '#3b82f6';

    return (
        <motion.div
            layout
            className={cn(
                "flex-shrink-0 cursor-pointer transition-all duration-200",
                isActive ? "z-10" : "z-0 opacity-60"
            )}
            onClick={onClick}
        >
            <motion.div
                layout
                className={cn(
                    "rounded-lg border bg-card overflow-hidden transition-all",
                    isActive ? "border-primary/50 shadow-lg" : "border-border/30",
                    isExpanded ? "w-64" : "w-40"
                )}
                style={{
                    borderLeftColor: cardColor,
                    borderLeftWidth: '3px',
                }}
            >
                {/* Collapsed View - Always visible */}
                <div
                    className="p-3 flex items-center gap-2"
                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                >
                    <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${cardColor}20` }}
                    >
                        <Icon className="w-3 h-3" style={{ color: cardColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.subLabel}</p>
                    </div>
                    {item.isCompleted ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    ) : (
                        <Clock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    )}
                </div>

                {/* Expanded View */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t bg-muted/20"
                        >
                            <div className="p-3 space-y-2">
                                {item.events.map((evt, i) => (
                                    <div key={evt.id || i} className="text-xs">
                                        <p className="font-medium">{evt.title}</p>
                                        {evt.description && (
                                            <p className="text-muted-foreground mt-0.5">{evt.description}</p>
                                        )}
                                        {evt.tags && evt.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {evt.tags.map(tag => (
                                                    <span
                                                        key={tag}
                                                        className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px]"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
}

// Single timeline track
function TimelineTrack({
    items,
    activeIndex,
    onIndexChange,
    expandedId,
    onExpandedChange,
    label,
}: {
    items: TimelineItem[];
    activeIndex: number;
    onIndexChange: (index: number) => void;
    expandedId: string | null;
    onExpandedChange: (id: string | null) => void;
    label: string;
}) {
    const trackRef = useRef<HTMLDivElement>(null);

    // Scroll to active card
    useEffect(() => {
        if (trackRef.current && items[activeIndex]) {
            const cards = trackRef.current.querySelectorAll('[data-card]');
            const activeCard = cards[activeIndex] as HTMLElement;
            if (activeCard) {
                activeCard.scrollIntoView({
                    behavior: 'smooth',
                    inline: 'center',
                    block: 'nearest',
                });
            }
        }
    }, [activeIndex, items]);

    if (items.length === 0) {
        return (
            <div className="flex items-center justify-center h-16 text-muted-foreground text-sm">
                No {label.toLowerCase()} to display
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Track label */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-r text-xs text-muted-foreground font-medium">
                {label}
            </div>

            {/* Horizontal line */}
            <div className="absolute left-0 right-0 top-1/2 h-px bg-border -translate-y-1/2" />

            {/* Cards container */}
            <div
                ref={trackRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide py-4 px-16"
                style={{ scrollSnapType: 'x mandatory' }}
            >
                {items.map((item, index) => (
                    <div key={item.id} data-card style={{ scrollSnapAlign: 'center' }}>
                        <TimelineCard
                            item={item}
                            isActive={index === activeIndex}
                            isExpanded={expandedId === item.id}
                            onToggle={() => onExpandedChange(expandedId === item.id ? null : item.id)}
                            onClick={() => onIndexChange(index)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function DualTimeline({ className = '', scale }: DualTimelineProps) {
    const { calendar, viewDate, events, highlightedEventId, periods } = useCalendarContext();

    const {
        periodItems,
        eventItems,
        expandedId,
        setExpandedId,
        activePeriodId,
        setActivePeriodId,
    } = useTimelineSync(events, calendar, viewDate.year, highlightedEventId, periods);

    // Separate active indices for each track
    const [periodActiveIndex, setPeriodActiveIndex] = useState(0);
    const [eventActiveIndex, setEventActiveIndex] = useState(0);

    // Auto-scroll to highlighted event
    useEffect(() => {
        if (!highlightedEventId) return;

        // Find in event items
        const eventIndex = eventItems.findIndex(item =>
            item.id === highlightedEventId || item.events.some(e => e.id === highlightedEventId)
        );
        if (eventIndex !== -1) {
            setEventActiveIndex(eventIndex);
            // Also sync period track
            const year = eventItems[eventIndex]?.year;
            if (year !== undefined) {
                const periodIndex = periodItems.findIndex(p => p.year === year);
                if (periodIndex !== -1) {
                    setPeriodActiveIndex(periodIndex);
                }
            }
        }
    }, [highlightedEventId, periodItems, eventItems]);

    // Navigation operates on event track (primary)
    const navigatePrev = () => {
        const newIndex = Math.max(0, eventActiveIndex - 1);
        setEventActiveIndex(newIndex);
        setExpandedId(null);
        // Sync period track
        const year = eventItems[newIndex]?.year;
        if (year !== undefined) {
            const periodIndex = periodItems.findIndex(p => p.year === year);
            if (periodIndex !== -1) setPeriodActiveIndex(periodIndex);
        }
    };

    const navigateNext = () => {
        const newIndex = Math.min(eventItems.length - 1, eventActiveIndex + 1);
        setEventActiveIndex(newIndex);
        setExpandedId(null);
        // Sync period track
        const year = eventItems[newIndex]?.year;
        if (year !== undefined) {
            const periodIndex = periodItems.findIndex(p => p.year === year);
            if (periodIndex !== -1) setPeriodActiveIndex(periodIndex);
        }
    };

    // Show component even if one track is empty
    if (periodItems.length === 0 && eventItems.length === 0) {
        return null;
    }

    return (
        <div className={cn("relative w-full", className)}>
            {/* Navigation buttons */}
            <button
                onClick={navigatePrev}
                disabled={eventActiveIndex === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-background/80 backdrop-blur-sm border p-1.5 rounded-full shadow-md hover:bg-muted/50 transition-colors disabled:opacity-30"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>
            <button
                onClick={navigateNext}
                disabled={eventActiveIndex === eventItems.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-background/80 backdrop-blur-sm border p-1.5 rounded-full shadow-md hover:bg-muted/50 transition-colors disabled:opacity-30"
            >
                <ChevronRight className="w-4 h-4" />
            </button>

            {/* Dual tracks layout - Always show both */}
            <div className="space-y-2">
                {/* Track A: Periods - wider cards */}
                <TimelineTrack
                    items={periodItems}
                    activeIndex={periodActiveIndex}
                    onIndexChange={(index) => {
                        setPeriodActiveIndex(index);
                        // Set active period to filter events
                        const periodId = periodItems[index]?.id;
                        if (periodId && !periodId.startsWith('period-')) {
                            // Real period from context
                            setActivePeriodId(periodId);
                        } else {
                            // Auto-generated year period
                            setActivePeriodId(null);
                        }
                        // Sync event track
                        const year = periodItems[index]?.year;
                        if (year !== undefined) {
                            const eventIndex = eventItems.findIndex(e => e.year === year);
                            if (eventIndex !== -1) {
                                setEventActiveIndex(eventIndex);
                            }
                        }
                    }}
                    expandedId={expandedId}
                    onExpandedChange={setExpandedId}
                    label="Periods"
                />
                {/* Track B: Individual Events */}
                <TimelineTrack
                    items={eventItems}
                    activeIndex={eventActiveIndex}
                    onIndexChange={(index) => {
                        setEventActiveIndex(index);
                        // Sync period track: find the period for this event's year
                        const year = eventItems[index]?.year;
                        if (year !== undefined) {
                            const periodIndex = periodItems.findIndex(p => p.year === year);
                            if (periodIndex !== -1) {
                                setPeriodActiveIndex(periodIndex);
                            }
                        }
                    }}
                    expandedId={expandedId}
                    onExpandedChange={setExpandedId}
                    label="Events"
                />
            </div>

            {/* Navigation dots - based on event track */}
            <div className="flex justify-center mt-2 gap-1">
                {eventItems.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => {
                            setEventActiveIndex(index);
                            // Sync period track
                            const year = eventItems[index]?.year;
                            if (year !== undefined) {
                                const periodIndex = periodItems.findIndex(p => p.year === year);
                                if (periodIndex !== -1) setPeriodActiveIndex(periodIndex);
                            }
                        }}
                        className={cn(
                            "transition-all duration-200 rounded-full",
                            index === eventActiveIndex
                                ? "w-6 h-1.5 bg-primary"
                                : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-primary/50"
                        )}
                    />
                ))}
            </div>
        </div>
    );
}

export default DualTimeline;
