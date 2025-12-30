/**
 * CausalityGraph - Mini visualization of event causal links
 */

"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarEvent } from '@/lib/fantasy-calendar/types';
import { useCalendarContext } from '@/contexts/CalendarContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRight, Link2, Unlink, GitBranch, GitMerge } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CausalityGraphProps {
    event: CalendarEvent;
    onEventClick?: (eventId: string) => void;
    compact?: boolean;
}

export function CausalityGraph({ event, onEventClick, compact = false }: CausalityGraphProps) {
    const { events, getCausalChain, getEventById, unlinkEvents } = useCalendarContext();

    const chain = useMemo(() => getCausalChain(event.id), [event.id, getCausalChain]);

    // Get actual event objects for upstream/downstream
    const upstreamEvents = useMemo(() =>
        chain.upstream.map(id => getEventById(id)).filter(Boolean) as CalendarEvent[],
        [chain.upstream, getEventById]
    );

    const downstreamEvents = useMemo(() =>
        chain.downstream.map(id => getEventById(id)).filter(Boolean) as CalendarEvent[],
        [chain.downstream, getEventById]
    );

    const hasLinks = upstreamEvents.length > 0 || downstreamEvents.length > 0;

    if (!hasLinks && compact) {
        return (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                No causal links
            </div>
        );
    }

    if (compact) {
        return (
            <div className="flex items-center gap-2 text-xs">
                {upstreamEvents.length > 0 && (
                    <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500/30">
                        <GitMerge className="h-3 w-3" />
                        {upstreamEvents.length} cause{upstreamEvents.length > 1 ? 's' : ''}
                    </Badge>
                )}
                {downstreamEvents.length > 0 && (
                    <Badge variant="outline" className="gap-1 text-emerald-500 border-emerald-500/30">
                        <GitBranch className="h-3 w-3" />
                        {downstreamEvents.length} effect{downstreamEvents.length > 1 ? 's' : ''}
                    </Badge>
                )}
            </div>
        );
    }

    // Full graph view
    return (
        <TooltipProvider>
            <div className="space-y-3">
                {/* Upstream - Causes */}
                {upstreamEvents.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium">
                            <GitMerge className="h-3.5 w-3.5" />
                            Caused By
                        </div>
                        <div className="flex flex-col gap-1">
                            {upstreamEvents.map(e => (
                                <motion.div
                                    key={e.id}
                                    className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                >
                                    <button
                                        onClick={() => onEventClick?.(e.id)}
                                        className="flex-1 text-left text-sm truncate hover:text-amber-400 transition-colors"
                                    >
                                        {e.title}
                                    </button>
                                    <ArrowRight className="h-3 w-3 text-amber-500" />
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                onClick={() => unlinkEvents(e.id, event.id)}
                                            >
                                                <Unlink className="h-3 w-3" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Remove link</TooltipContent>
                                    </Tooltip>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Current Event Indicator */}
                <div className="flex items-center justify-center">
                    <div className="px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-xs font-medium">
                        {event.title}
                    </div>
                </div>

                {/* Downstream - Effects */}
                {downstreamEvents.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                            <GitBranch className="h-3.5 w-3.5" />
                            Leads To
                        </div>
                        <div className="flex flex-col gap-1">
                            {downstreamEvents.map(e => (
                                <motion.div
                                    key={e.id}
                                    className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                >
                                    <ArrowRight className="h-3 w-3 text-emerald-500" />
                                    <button
                                        onClick={() => onEventClick?.(e.id)}
                                        className="flex-1 text-left text-sm truncate hover:text-emerald-400 transition-colors"
                                    >
                                        {e.title}
                                    </button>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                onClick={() => unlinkEvents(event.id, e.id)}
                                            >
                                                <Unlink className="h-3 w-3" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Remove link</TooltipContent>
                                    </Tooltip>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!hasLinks && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                        <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>No causal links yet</p>
                        <p className="text-xs">Link this event to show cause and effect relationships</p>
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
}

export default CausalityGraph;
