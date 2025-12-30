/**
 * Binding Indicator
 * 
 * Visual indicator shown on fields that have bindings.
 * Shows a link icon with tooltip explaining the binding.
 */

import React from 'react';
import { Link, Link2Off, ArrowRight, ArrowLeftRight, Sigma } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { FieldBinding, BindingType } from '@/lib/bindings';

interface BindingIndicatorProps {
    binding: FieldBinding;
    targetEntityName?: string;
    isOverridden?: boolean;
    onClick?: () => void;
    className?: string;
}

const bindingIcons: Record<BindingType, typeof Link> = {
    inherit: ArrowRight,
    mirror: ArrowLeftRight,
    aggregate: Sigma,
};

const bindingColors: Record<BindingType, string> = {
    inherit: 'text-blue-400',
    mirror: 'text-purple-400',
    aggregate: 'text-emerald-400',
};

const bindingLabels: Record<BindingType, string> = {
    inherit: 'Inherited from',
    mirror: 'Mirrored with',
    aggregate: 'Aggregated from',
};

export function BindingIndicator({
    binding,
    targetEntityName,
    isOverridden = false,
    onClick,
    className,
}: BindingIndicatorProps) {
    const Icon = isOverridden ? Link2Off : bindingIcons[binding.bindingType];
    const colorClass = isOverridden ? 'text-muted-foreground' : bindingColors[binding.bindingType];

    const tooltipContent = isOverridden
        ? 'Binding overridden with local value'
        : `${bindingLabels[binding.bindingType]} ${targetEntityName || binding.targetEntityId}.${binding.targetFieldName}`;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={onClick}
                    className={cn(
                        'inline-flex items-center justify-center h-5 w-5 rounded-sm',
                        'hover:bg-muted transition-colors',
                        colorClass,
                        className
                    )}
                >
                    <Icon className="h-3.5 w-3.5" />
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
                <div className="text-xs">
                    <div className="font-medium">{binding.bindingType.charAt(0).toUpperCase() + binding.bindingType.slice(1)} Binding</div>
                    <div className="text-muted-foreground">{tooltipContent}</div>
                    {binding.transform && (
                        <div className="text-muted-foreground mt-1">
                            Transform: {binding.transform.type}
                            {binding.transform.params?.value !== undefined && `:${binding.transform.params.value}`}
                        </div>
                    )}
                    {binding.aggregationFn && (
                        <div className="text-muted-foreground mt-1">
                            Aggregation: {binding.aggregationFn}
                        </div>
                    )}
                </div>
            </TooltipContent>
        </Tooltip>
    );
}

/**
 * Small badge for inline display
 */
interface BindingBadgeProps {
    type: BindingType;
    className?: string;
}

export function BindingBadge({ type, className }: BindingBadgeProps) {
    const Icon = bindingIcons[type];
    const colorClass = bindingColors[type];

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs',
                'bg-muted/50',
                colorClass,
                className
            )}
        >
            <Icon className="h-3 w-3" />
            {type}
        </span>
    );
}
