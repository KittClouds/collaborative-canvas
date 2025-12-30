import React, { useState, useCallback, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EditableCounterProps {
    value: number;
    onChange: (value: number) => void;
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    showButtons?: boolean;
    className?: string;
}

export function EditableCounter({
    value,
    onChange,
    label,
    min,
    max,
    step = 1,
    showButtons = true,
    className,
}: EditableCounterProps) {
    const [isAnimating, setIsAnimating] = useState<'up' | 'down' | null>(null);

    const clamp = useCallback(
        (val: number) => {
            let clamped = val;
            if (min !== undefined) clamped = Math.max(min, clamped);
            if (max !== undefined) clamped = Math.min(max, clamped);
            return clamped;
        },
        [min, max]
    );

    const increment = useCallback(() => {
        const newValue = clamp(value + step);
        if (newValue !== value) {
            onChange(newValue);
            setIsAnimating('up');
            setTimeout(() => setIsAnimating(null), 150);
        }
    }, [value, step, clamp, onChange]);

    const decrement = useCallback(() => {
        const newValue = clamp(value - step);
        if (newValue !== value) {
            onChange(newValue);
            setIsAnimating('down');
            setTimeout(() => setIsAnimating(null), 150);
        }
    }, [value, step, clamp, onChange]);

    const canIncrement = max === undefined || value < max;
    const canDecrement = min === undefined || value > min;

    return (
        <div className={cn('space-y-1', className)}>
            {label && (
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
            )}

            <div className="flex items-center gap-2">
                {showButtons && (
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                            'h-8 w-8 rounded-full transition-all',
                            !canDecrement && 'opacity-40 cursor-not-allowed'
                        )}
                        onClick={decrement}
                        disabled={!canDecrement}
                    >
                        <Minus className="h-4 w-4" />
                    </Button>
                )}

                <div
                    className={cn(
                        'min-w-[60px] h-10 flex items-center justify-center',
                        'rounded-lg bg-muted/30 border border-border/50',
                        'text-2xl font-bold tabular-nums transition-transform',
                        isAnimating === 'up' && 'animate-bounce-subtle',
                        isAnimating === 'down' && 'animate-bounce-subtle-reverse'
                    )}
                >
                    <span
                        className={cn(
                            'transition-colors',
                            value === max && 'text-amber-500',
                            value === min && 'text-muted-foreground',
                            value !== max && value !== min && 'text-foreground'
                        )}
                    >
                        {value}
                    </span>
                </div>

                {showButtons && (
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                            'h-8 w-8 rounded-full transition-all',
                            !canIncrement && 'opacity-40 cursor-not-allowed'
                        )}
                        onClick={increment}
                        disabled={!canIncrement}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Range indicator */}
            {(min !== undefined || max !== undefined) && (
                <div className="text-[10px] text-muted-foreground/60 text-center">
                    {min !== undefined && max !== undefined
                        ? `${min} – ${max}`
                        : min !== undefined
                            ? `Min: ${min}`
                            : `Max: ${max}`}
                </div>
            )}
        </div>
    );
}
