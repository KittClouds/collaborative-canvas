import React from 'react';
import { LayoutList, List, Calendar, GitBranch, GitMerge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type TimelineViewMode =
    | 'cards'      // Vertical card list (default)
    | 'compact'    // Condensed list view
    | 'calendar'   // Mini calendar grid
    | 'flow'       // Horizontal flow
    | 'tree';      // Hierarchical tree view

interface TimelineViewModeSelectorProps {
    mode: TimelineViewMode;
    onModeChange: (mode: TimelineViewMode) => void;
    className?: string;
}

export function TimelineViewModeSelector({
    mode,
    onModeChange,
    className
}: TimelineViewModeSelectorProps) {

    const buttons = [
        { value: 'cards', icon: LayoutList, label: 'Cards' },
        { value: 'compact', icon: List, label: 'Compact' },
        { value: 'calendar', icon: Calendar, label: 'Calendar' },
        { value: 'flow', icon: GitMerge, label: 'Flow' }, // Using GitMerge as 'Flow' proxy
        { value: 'tree', icon: GitBranch, label: 'Tree' },
    ] as const;

    return (
        <div className={cn("inline-flex items-center rounded-lg border border-border p-0.5 bg-muted/50", className)}>
            <TooltipProvider delayDuration={300}>
                {buttons.map(({ value, icon: Icon, label }) => (
                    <Tooltip key={value}>
                        <TooltipTrigger asChild>
                            <Button
                                variant={mode === value ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => onModeChange(value as TimelineViewMode)}
                                className={cn(
                                    "h-6 w-7 px-0",
                                    mode === value && "bg-background shadow-sm"
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                <span className="sr-only">{label}</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                            {label}
                        </TooltipContent>
                    </Tooltip>
                ))}
            </TooltipProvider>
        </div>
    );
}
