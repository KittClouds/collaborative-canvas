import React, { useState } from 'react';
import { Star, Heart, Circle, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

type IconType = 'star' | 'heart' | 'circle' | 'flame';

const ICONS: Record<IconType, typeof Star> = {
    star: Star,
    heart: Heart,
    circle: Circle,
    flame: Flame,
};

interface EditableRatingProps {
    value: number;
    onChange: (value: number) => void;
    label?: string;
    maxRating?: number;
    icon?: IconType;
    allowHalf?: boolean;
    color?: string;
    className?: string;
}

export function EditableRating({
    value,
    onChange,
    label,
    maxRating = 5,
    icon = 'star',
    allowHalf = false,
    color = '#f59e0b',
    className,
}: EditableRatingProps) {
    const [hoverValue, setHoverValue] = useState<number | null>(null);
    const IconComponent = ICONS[icon] || Star;

    const displayValue = hoverValue ?? value;

    const handleClick = (index: number, isHalf: boolean) => {
        const newValue = isHalf && allowHalf ? index + 0.5 : index + 1;
        onChange(newValue === value ? 0 : newValue);
    };

    const handleMouseMove = (index: number, e: React.MouseEvent) => {
        if (allowHalf) {
            const rect = e.currentTarget.getBoundingClientRect();
            const isHalf = e.clientX - rect.left < rect.width / 2;
            setHoverValue(isHalf ? index + 0.5 : index + 1);
        } else {
            setHoverValue(index + 1);
        }
    };

    return (
        <div className={cn('space-y-1', className)}>
            {label && (
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
            )}

            <div
                className="flex items-center gap-1"
                onMouseLeave={() => setHoverValue(null)}
            >
                {Array.from({ length: maxRating }, (_, index) => {
                    const isFilled = index + 1 <= displayValue;
                    const isHalfFilled = !isFilled && index + 0.5 <= displayValue;

                    return (
                        <button
                            key={index}
                            type="button"
                            className={cn(
                                'relative p-0.5 transition-transform hover:scale-110 focus:outline-none',
                                'cursor-pointer'
                            )}
                            onMouseMove={(e) => handleMouseMove(index, e)}
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const isHalf = allowHalf && e.clientX - rect.left < rect.width / 2;
                                handleClick(index, isHalf);
                            }}
                        >
                            {/* Background (empty) icon */}
                            <IconComponent
                                className="h-6 w-6 text-muted-foreground/30"
                                strokeWidth={1.5}
                            />

                            {/* Filled icon (full or half) */}
                            {(isFilled || isHalfFilled) && (
                                <div
                                    className="absolute inset-0.5 overflow-hidden"
                                    style={{
                                        width: isHalfFilled ? '50%' : '100%',
                                    }}
                                >
                                    <IconComponent
                                        className="h-6 w-6"
                                        fill={color}
                                        stroke={color}
                                        strokeWidth={1.5}
                                    />
                                </div>
                            )}
                        </button>
                    );
                })}

                {/* Numeric display */}
                <span className="ml-2 text-sm text-muted-foreground tabular-nums">
                    {value.toFixed(allowHalf ? 1 : 0)}/{maxRating}
                </span>
            </div>
        </div>
    );
}
