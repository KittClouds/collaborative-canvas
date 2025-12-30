/**
 * StoryBeatSelector - Visual picker for narrative beats (Save the Cat structure)
 */

"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { StoryBeat } from '@/lib/fantasy-calendar/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface StoryBeatSelectorProps {
    value?: StoryBeat;
    onChange: (beat: StoryBeat | undefined) => void;
    compact?: boolean;
}

// Story beat definitions with colors and descriptions
const STORY_BEATS: { id: StoryBeat; label: string; color: string; description: string; section: string }[] = [
    // Act 1
    { id: 'opening_image', label: 'Opening Image', color: '#60a5fa', description: 'Sets the tone and mood', section: 'Act 1' },
    { id: 'theme_stated', label: 'Theme Stated', color: '#818cf8', description: 'The lesson to be learned', section: 'Act 1' },
    { id: 'setup', label: 'Setup', color: '#a78bfa', description: 'Introduce the world and characters', section: 'Act 1' },
    { id: 'catalyst', label: 'Catalyst', color: '#f472b6', description: 'The inciting incident', section: 'Act 1' },
    { id: 'debate', label: 'Debate', color: '#fb7185', description: 'Hero resists the call', section: 'Act 1' },
    { id: 'break_into_two', label: 'Break Into 2', color: '#ef4444', description: 'Enter the new world', section: 'Act 1' },

    // Act 2
    { id: 'b_story', label: 'B Story', color: '#f97316', description: 'The love/friendship story', section: 'Act 2' },
    { id: 'fun_and_games', label: 'Fun & Games', color: '#fbbf24', description: 'The promise of the premise', section: 'Act 2' },
    { id: 'midpoint', label: 'Midpoint', color: '#84cc16', description: 'False victory or defeat', section: 'Act 2' },
    { id: 'bad_guys_close_in', label: 'Bad Guys Close In', color: '#22c55e', description: 'Things fall apart', section: 'Act 2' },
    { id: 'all_is_lost', label: 'All Is Lost', color: '#14b8a6', description: 'The lowest point', section: 'Act 2' },
    { id: 'dark_night_of_soul', label: 'Dark Night', color: '#06b6d4', description: 'The moment before breakthrough', section: 'Act 2' },

    // Act 3
    { id: 'break_into_three', label: 'Break Into 3', color: '#0ea5e9', description: 'The solution emerges', section: 'Act 3' },
    { id: 'finale', label: 'Finale', color: '#6366f1', description: 'The final confrontation', section: 'Act 3' },
    { id: 'final_image', label: 'Final Image', color: '#8b5cf6', description: 'The new normal', section: 'Act 3' },
];

export function StoryBeatSelector({ value, onChange, compact = false }: StoryBeatSelectorProps) {
    const selectedBeat = STORY_BEATS.find(b => b.id === value);

    if (compact) {
        return (
            <div className="flex flex-wrap gap-1">
                {STORY_BEATS.map(beat => (
                    <TooltipProvider key={beat.id}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => onChange(value === beat.id ? undefined : beat.id)}
                                    className={cn(
                                        "w-4 h-4 rounded-full border-2 transition-all",
                                        value === beat.id
                                            ? "ring-2 ring-offset-1 ring-offset-background"
                                            : "opacity-60 hover:opacity-100"
                                    )}
                                    style={{
                                        backgroundColor: beat.color,
                                        borderColor: value === beat.id ? beat.color : 'transparent',
                                        boxShadow: value === beat.id ? `0 0 8px ${beat.color}50` : 'none'
                                    }}
                                />
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="font-medium">{beat.label}</p>
                                <p className="text-xs text-muted-foreground">{beat.description}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ))}
            </div>
        );
    }

    // Full selector with sections
    const sections = ['Act 1', 'Act 2', 'Act 3'];

    return (
        <div className="space-y-3">
            {/* Current Selection */}
            {selectedBeat && (
                <div
                    className="flex items-center gap-2 p-2 rounded-md border"
                    style={{ borderColor: `${selectedBeat.color}50`, backgroundColor: `${selectedBeat.color}10` }}
                >
                    <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: selectedBeat.color }}
                    />
                    <span className="text-sm font-medium">{selectedBeat.label}</span>
                    <span className="text-xs text-muted-foreground">— {selectedBeat.description}</span>
                </div>
            )}

            {/* Beat Grid by Section */}
            {sections.map(section => (
                <div key={section} className="space-y-1.5">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        {section}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {STORY_BEATS.filter(b => b.section === section).map(beat => (
                            <motion.button
                                key={beat.id}
                                onClick={() => onChange(value === beat.id ? undefined : beat.id)}
                                className={cn(
                                    "px-2 py-1 rounded text-[10px] font-medium transition-all",
                                    value === beat.id
                                        ? "ring-1 ring-offset-1 ring-offset-background"
                                        : "opacity-70 hover:opacity-100"
                                )}
                                style={{
                                    backgroundColor: `${beat.color}20`,
                                    color: beat.color,
                                    borderColor: beat.color,
                                }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {beat.label}
                            </motion.button>
                        ))}
                    </div>
                </div>
            ))}

            {/* Clear button */}
            {value && (
                <button
                    onClick={() => onChange(undefined)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    Clear selection
                </button>
            )}
        </div>
    );
}

export default StoryBeatSelector;
