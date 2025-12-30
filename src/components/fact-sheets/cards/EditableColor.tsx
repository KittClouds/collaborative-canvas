import React, { useState } from 'react';
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

// Default color palette
const DEFAULT_PALETTE = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#78716c', '#64748b', '#1e293b',
];

interface EditableColorProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    palette?: string[];
    allowCustom?: boolean;
    className?: string;
}

export function EditableColor({
    value,
    onChange,
    label,
    palette = DEFAULT_PALETTE,
    allowCustom = true,
    className,
}: EditableColorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [customColor, setCustomColor] = useState(value || '#3b82f6');

    const handleColorSelect = (color: string) => {
        onChange(color);
        setIsOpen(false);
    };

    const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setCustomColor(newColor);
        onChange(newColor);
    };

    return (
        <div className={cn('space-y-1', className)}>
            {label && (
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
            )}

            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="w-full justify-start h-9 gap-2"
                    >
                        <div
                            className="h-5 w-5 rounded-md border border-border/50 shadow-sm"
                            style={{ backgroundColor: value || '#808080' }}
                        />
                        <span className="text-sm font-mono text-muted-foreground">
                            {value || 'Select color...'}
                        </span>
                        <Palette className="ml-auto h-4 w-4 text-muted-foreground" />
                    </Button>
                </PopoverTrigger>

                <PopoverContent className="w-64 p-3" align="start">
                    {/* Color palette */}
                    <div className="grid grid-cols-5 gap-2 mb-3">
                        {palette.map((color) => (
                            <button
                                key={color}
                                className={cn(
                                    'h-8 w-8 rounded-md border-2 transition-all hover:scale-110',
                                    value === color
                                        ? 'border-foreground ring-2 ring-foreground/20'
                                        : 'border-transparent'
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() => handleColorSelect(color)}
                            />
                        ))}
                    </div>

                    {/* Custom color input */}
                    {allowCustom && (
                        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                            <input
                                type="color"
                                value={customColor}
                                onChange={handleCustomColorChange}
                                className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                            />
                            <Input
                                type="text"
                                value={customColor}
                                onChange={(e) => {
                                    setCustomColor(e.target.value);
                                    if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                                        onChange(e.target.value);
                                    }
                                }}
                                placeholder="#000000"
                                className="h-8 font-mono text-sm uppercase"
                            />
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    );
}
