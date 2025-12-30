"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Calendar,
    CheckCircle,
    Clock,
    Circle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCalendarContext } from '@/contexts/CalendarContext';
import { formatYearWithEra } from '@/lib/fantasy-calendar/utils';
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

export type TimeScale = 'month' | 'year' | 'decade' | 'century';

interface TimelineBarProps {
    className?: string;
    scale: TimeScale;
}

const height = "30rem";

export function TimelineBar({ className = '', scale }: TimelineBarProps) {
    const { calendar, viewDate, events, goToYear, highlightedEventId } = useCalendarContext();
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [expandedHeight, setExpandedHeight] = useState<number>(100);
    const carouselRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);

    // Transform events into the format expected by the carousel
    const timelineEvents = useMemo(() => {
        const items: {
            periodLabel: string;
            subLabel: string;
            year: number;
            monthIndex?: number;
            dayIndex?: number;
            events: { id: string; title: string; isChecked: boolean }[];
            isChecked: boolean;
            icon?: string;
            color?: string;
        }[] = [];


        // MONTH SCALE: Individual cards per event
        if (scale === 'month') {
            // Sort events chronologically
            const sortedEvents = [...events].sort((a, b) => {
                if (a.date.year !== b.date.year) return a.date.year - b.date.year;
                if (a.date.monthIndex !== b.date.monthIndex) return a.date.monthIndex - b.date.monthIndex;
                return a.date.dayIndex - b.date.dayIndex;
            });

            // Each event gets its own card
            sortedEvents.forEach(e => {
                const monthName = calendar.months[e.date.monthIndex]?.name || `Month ${e.date.monthIndex + 1}`;
                const eventType = e.eventTypeId ? getEventTypeById(e.eventTypeId) : undefined;

                items.push({
                    periodLabel: e.title,
                    subLabel: `${monthName} ${e.date.dayIndex + 1}, ${formatYearWithEra(calendar, e.date.year)}`,
                    year: e.date.year,
                    monthIndex: e.date.monthIndex,
                    dayIndex: e.date.dayIndex,
                    events: [{ id: e.id, title: e.description || 'No description', isChecked: true }],
                    isChecked: e.date.year < viewDate.year ||
                        (e.date.year === viewDate.year && e.date.monthIndex < viewDate.monthIndex),
                    icon: eventType?.icon,
                    color: e.color || eventType?.color
                });
            });

            // Add time markers as separate cards too
            calendar.timeMarkers.forEach(m => {
                items.push({
                    periodLabel: m.name,
                    subLabel: `Marker - ${formatYearWithEra(calendar, m.year)}`,
                    year: m.year,
                    events: [{ id: `marker-${m.year}`, title: m.description || 'Time marker', isChecked: true }],
                    isChecked: m.year < viewDate.year
                });
            });

            // YEAR/DECADE/CENTURY SCALE: Group by year
        } else {
            const eventsByYear = new Map<number, typeof events[0][]>();
            const markersByYear = new Map<number, typeof calendar.timeMarkers[0][]>();

            events.forEach(e => {
                const arr = eventsByYear.get(e.date.year) || [];
                arr.push(e);
                eventsByYear.set(e.date.year, arr);
            });

            calendar.timeMarkers.forEach(m => {
                const arr = markersByYear.get(m.year) || [];
                arr.push(m);
                markersByYear.set(m.year, arr);
            });

            const allYears = new Set([...eventsByYear.keys(), ...markersByYear.keys()]);
            const sortedYears = Array.from(allYears).sort((a, b) => a - b);

            if (sortedYears.length === 0) {
                sortedYears.push(viewDate.year);
            }

            sortedYears.forEach(year => {
                const yearEvents = eventsByYear.get(year) || [];
                const yearMarkers = markersByYear.get(year) || [];

                const combinedEvents = [
                    ...yearMarkers.map(m => ({ id: `marker-${m.year}`, title: `📍 ${m.name}`, isChecked: true })),
                    ...yearEvents.map(e => ({ id: e.id, title: e.title, isChecked: true }))
                ];

                items.push({
                    periodLabel: formatYearWithEra(calendar, year),
                    subLabel: `${combinedEvents.length} Item${combinedEvents.length !== 1 ? 's' : ''}`,
                    year: year,
                    events: combinedEvents,
                    isChecked: year < viewDate.year
                });
            });
        }

        // Sort by date (year, then month, then day)
        return items.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            if (a.monthIndex !== undefined && b.monthIndex !== undefined) {
                if (a.monthIndex !== b.monthIndex) return a.monthIndex - b.monthIndex;
                if (a.dayIndex !== undefined && b.dayIndex !== undefined) {
                    return a.dayIndex - b.dayIndex;
                }
            }
            return 0;
        });
    }, [calendar, events, viewDate.year, viewDate.monthIndex, scale]);

    // Set initial current index to the item closest to current view year
    useEffect(() => {
        if (timelineEvents.length > 0) {
            const index = timelineEvents.findIndex(item => item.year >= viewDate.year);
            if (index !== -1) setCurrentIndex(index);
            else setCurrentIndex(timelineEvents.length - 1);
        }
    }, [timelineEvents, viewDate.year]);

    useEffect(() => {
        if (carouselRef.current && headerRef.current) {
            const totalHeight = carouselRef.current.getBoundingClientRect().height;
            const headerHeight = headerRef.current.getBoundingClientRect().height;
            const availableHeight = totalHeight - headerHeight - 110;
            setExpandedHeight(Math.max(availableHeight, 50));
        }
    }, [expandedIndex]); // Re-calc when expanding

    // Auto-scroll to highlighted event
    useEffect(() => {
        if (!highlightedEventId || timelineEvents.length === 0) return;

        // Find if any item contains the highlighted event
        // For month scale, the item IS the event (mostly)
        const index = timelineEvents.findIndex(item =>
            // Check if item corresponds to event directly (month scale logic was: item.events has desc, periodLabel is title)
            // But we didn't store event ID on the item root. We stored it in 'events' array
            item.events.some(e => e.id === highlightedEventId)
        );

        if (index !== -1 && index !== currentIndex) {
            setCurrentIndex(index);
        }
    }, [highlightedEventId, timelineEvents]);

    const toggleExpand = (index: number) => {
        if (index === currentIndex) {
            setExpandedIndex(expandedIndex === index ? null : index);
        }
    };

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev === timelineEvents.length - 1 ? 0 : prev + 1));
        setExpandedIndex(null);
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev === 0 ? timelineEvents.length - 1 : prev - 1));
        setExpandedIndex(null);
    };

    const goToSlide = (index: number) => {
        setCurrentIndex(index);
        setExpandedIndex(null);
    };

    const jumpToYear = (year: number) => {
        goToYear(year);
    };

    const handleDragEnd = (
        event: MouseEvent | TouchEvent | PointerEvent,
        info: PanInfo,
        index: number
    ) => {
        const SWIPE_THRESHOLD = 50;
        if (info.offset.x > SWIPE_THRESHOLD && index === currentIndex) {
            prevSlide();
        } else if (info.offset.x < -SWIPE_THRESHOLD && index === currentIndex) {
            nextSlide();
        }
    };

    const cardVariants: import("framer-motion").Variants = {
        active: {
            x: 0,
            scale: 1,
            opacity: 1,
            zIndex: 10,
            transition: { duration: 0.3, ease: "easeInOut" },
        },
        inactive: {
            scale: 0.9,
            opacity: 0.7,
            zIndex: 0,
            transition: { duration: 0.3, ease: "easeInOut" },
        },
    };

    if (timelineEvents.length === 0) {
        return null;
    }

    return (
        <div className={`mx-auto px-4 py-2 w-full max-w-7xl ${className}`}>
            {/* Header removed as it's redundant with page header */}

            <div className="relative">
                <button
                    onClick={prevSlide}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-background/80 backdrop-blur-sm border p-2 rounded-full shadow-md hover:bg-muted/50 transition-colors"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                    onClick={nextSlide}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-background/80 backdrop-blur-sm border p-2 rounded-full shadow-md hover:bg-muted/50 transition-colors"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>

                {/* Timeline Line */}
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-border z-0"></div>

                <div
                    ref={carouselRef}
                    className="relative overflow-hidden touch-pan-x"
                    style={{ height: '280px' }}
                >
                    <div className="flex h-full items-center justify-center">
                        {timelineEvents.map((item, index) => (
                            <motion.div
                                key={index}
                                className="absolute w-64 mx-4"
                                variants={cardVariants}
                                initial="inactive"
                                animate={index === currentIndex ? "active" : "inactive"}
                                style={{
                                    x: index === currentIndex ? 0 : (index - currentIndex) * 320, // Manual offset calculation for inactive cards
                                    willChange: "transform",
                                    //   transform: "translateZ(0)",
                                }}
                                drag="x"
                                dragConstraints={{ left: -50, right: 50 }}
                                dragElastic={0.1}
                                onDragEnd={(e, info) => handleDragEnd(e, info, index)}
                            >
                                {/* Dot on the line */}
                                <motion.div
                                    variants={cardVariants}
                                    initial="inactive"
                                    animate={index === currentIndex ? "active" : "inactive"}
                                    className={`absolute left-1/2 top-[-1rem] w-6 h-6 rounded-full transform -translate-x-1/2 z-10 flex items-center justify-center transition-colors duration-300 ${index === currentIndex
                                        ? "bg-primary border-4 border-background shadow-sm"
                                        : "border-2 border-muted-foreground/30 bg-background"
                                        }`}
                                />

                                <motion.div
                                    layout
                                    className="w-full"
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                >
                                    <Card className={`overflow-hidden transition-all duration-300 ${index === currentIndex
                                        ? "border-primary/20 shadow-xl"
                                        : "border-border/50 shadow-none opacity-60 grayscale-[0.5]"
                                        }`}>
                                        <CardContent className="p-0">
                                            <div
                                                ref={index === currentIndex ? headerRef : null}
                                                className={`p-6 flex flex-col items-center text-center ${index === currentIndex
                                                    ? "cursor-pointer"
                                                    : "cursor-default"
                                                    }`}
                                                onClick={() => toggleExpand(index)}
                                            >

                                                <Badge
                                                    variant="secondary"
                                                    className="mb-3 font-mono"
                                                    style={item.color && item.icon ? {
                                                        backgroundColor: `${item.color}20`,
                                                        color: item.color,
                                                        borderColor: `${item.color}40`
                                                    } : undefined}
                                                >
                                                    {(() => {
                                                        const Icon = item.icon ? getIcon(item.icon) : Calendar;
                                                        return <Icon className="w-3.5 h-3.5 mr-1" />;
                                                    })()}
                                                    {item.year}
                                                </Badge>

                                                <h3 className="text-xl font-bold tracking-tight mb-1">
                                                    {item.periodLabel}
                                                </h3>
                                                <p className="text-sm text-muted-foreground font-medium">
                                                    {item.subLabel}
                                                </p>

                                                <div className="flex items-center text-xs text-muted-foreground mt-3 bg-muted/50 px-2 py-1 rounded-full">
                                                    {item.isChecked ? (
                                                        <>
                                                            <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                                                            <span>Completed</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock className="w-3 h-3 mr-1 text-blue-500" />
                                                            <span>Upcoming</span>
                                                        </>
                                                    )}
                                                </div>

                                                {item.events.length > 0 && (
                                                    <motion.div
                                                        animate={{
                                                            rotate: expandedIndex === index ? 180 : 0,
                                                            opacity: index === currentIndex ? 1 : 0.5,
                                                        }}
                                                        transition={{ duration: 0.3 }}
                                                        className="mt-3"
                                                    >
                                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                    </motion.div>
                                                )}

                                                {/* Jump to this year button (only visible if active) */}
                                                {index === currentIndex && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            jumpToYear(item.year);
                                                        }}
                                                        className="mt-4 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-md transition-colors"
                                                    >
                                                        Go to Year
                                                    </button>
                                                )}
                                            </div>

                                            <AnimatePresence>
                                                {expandedIndex === index && index === currentIndex && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: expandedHeight, opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                                        className="overflow-y-auto custom-scrollbar bg-muted/10 border-t"
                                                    >
                                                        <div className="p-4">
                                                            <ul className="space-y-3">
                                                                {item.events.map((event, i) => (
                                                                    <motion.li
                                                                        key={i}
                                                                        className="flex items-start text-left group"
                                                                        initial={{ opacity: 0, x: -10 }}
                                                                        animate={{ opacity: 1, x: 0 }}
                                                                        transition={{
                                                                            duration: 0.2,
                                                                            delay: i * 0.05,
                                                                            ease: "easeOut",
                                                                        }}
                                                                    >
                                                                        <div className="mt-1 mr-2.5 relative">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                                                                        </div>
                                                                        <span className="text-sm leading-snug text-muted-foreground group-hover:text-foreground transition-colors">
                                                                            {event.title}
                                                                        </span>
                                                                    </motion.li>
                                                                ))}
                                                                {item.events.length === 0 && (
                                                                    <li className="text-xs text-center text-muted-foreground py-2 italic">
                                                                        No specific events recorded
                                                                    </li>
                                                                )}
                                                            </ul>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Navigation Dots */}
                <div className="flex justify-center mt-4 gap-1.5">
                    {timelineEvents.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`transition-all duration-300 ${index === currentIndex
                                ? "w-8 h-1.5 bg-primary rounded-full"
                                : "w-1.5 h-1.5 bg-muted-foreground/30 rounded-full hover:bg-primary/50"
                                }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default TimelineBar;
