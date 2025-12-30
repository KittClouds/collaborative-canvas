import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface EditableSliderProps {
    value: number;
    onChange: (value: number) => void;
    label?: string;
    min: number;
    max: number;
    step?: number;
    showValue?: boolean;
    color?: string;
    marks?: Array<{ value: number; label: string }>;
    className?: string;
}

export function EditableSlider({
    value,
    onChange,
    label,
    min,
    max,
    step = 1,
    showValue = true,
    color = '#3b82f6',
    marks,
    className,
}: EditableSliderProps) {
    const [localValue, setLocalValue] = useState(value);
    const [isDragging, setIsDragging] = useState(false);

    // Sync external value
    useEffect(() => {
        if (!isDragging) {
            setLocalValue(value);
        }
    }, [value, isDragging]);

    const percentage = ((localValue - min) / (max - min)) * 100;

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = parseFloat(e.target.value);
            setLocalValue(newValue);
            onChange(newValue);
        },
        [onChange]
    );

    return (
        <div className={cn('space-y-2', className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                {label && (
                    <label className="text-xs font-medium text-muted-foreground">{label}</label>
                )}
                {showValue && (
                    <span className="text-sm font-medium text-foreground tabular-nums">
                        {localValue}
                    </span>
                )}
            </div>

            {/* Slider Track */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center w-full">
                    <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-75"
                            style={{
                                width: `${percentage}%`,
                                backgroundColor: color,
                            }}
                        />
                    </div>
                </div>

                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localValue}
                    onChange={handleChange}
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onTouchStart={() => setIsDragging(true)}
                    onTouchEnd={() => setIsDragging(false)}
                    className="relative w-full h-2 appearance-none bg-transparent cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-primary
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-primary
            [&::-moz-range-thumb]:shadow-md"
                />
            </div>

            {/* Marks */}
            {marks && marks.length > 0 && (
                <div className="relative flex justify-between text-[10px] text-muted-foreground/70 px-1">
                    {marks.map((mark) => (
                        <span
                            key={mark.value}
                            className="cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => {
                                setLocalValue(mark.value);
                                onChange(mark.value);
                            }}
                        >
                            {mark.label}
                        </span>
                    ))}
                </div>
            )}

            {/* Min/Max labels */}
            {!marks && (
                <div className="flex justify-between text-[10px] text-muted-foreground/70">
                    <span>{min}</span>
                    <span>{max}</span>
                </div>
            )}
        </div>
    );
}
