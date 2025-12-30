import React from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

interface EditableToggleProps {
    value: boolean;
    onChange: (value: boolean) => void;
    label?: string;
    onLabel?: string;
    offLabel?: string;
    className?: string;
}

export function EditableToggle({
    value,
    onChange,
    label,
    onLabel = 'On',
    offLabel = 'Off',
    className,
}: EditableToggleProps) {
    return (
        <div className={cn('space-y-1', className)}>
            {label && (
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
            )}

            <div className="flex items-center gap-3">
                <span
                    className={cn(
                        'text-sm transition-colors cursor-pointer',
                        !value ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}
                    onClick={() => onChange(false)}
                >
                    {offLabel}
                </span>

                <Switch
                    checked={value}
                    onCheckedChange={onChange}
                    className="data-[state=checked]:bg-primary"
                />

                <span
                    className={cn(
                        'text-sm transition-colors cursor-pointer',
                        value ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}
                    onClick={() => onChange(true)}
                >
                    {onLabel}
                </span>
            </div>
        </div>
    );
}
