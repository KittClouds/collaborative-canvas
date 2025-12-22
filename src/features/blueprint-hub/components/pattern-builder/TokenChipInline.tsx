/**
 * TokenChipInline - Inline editable token display with drag support
 */

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { GripVertical, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PatternToken, CaptureRole } from './types';

interface TokenChipInlineProps {
    token: PatternToken;
    index: number;
    onUpdate: (updates: Partial<PatternToken>) => void;
    onRemove: () => void;
}

const TOKEN_COLORS: Record<string, string> = {
    prefix: 'border-blue-500/50 bg-blue-500/10',
    wrapper: 'border-purple-500/50 bg-purple-500/10',
    separator: 'border-amber-500/50 bg-amber-500/10',
    capture: 'border-emerald-500/50 bg-emerald-500/10',
    literal: 'border-gray-500/50 bg-gray-500/10',
};

export function TokenChipInline({ token, index, onUpdate, onRemove }: TokenChipInlineProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: token.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const [isEditing, setIsEditing] = useState(false);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'inline-flex items-center gap-1 border-2 rounded-lg px-3 py-2 shadow-sm bg-background',
                TOKEN_COLORS[token.type],
                isDragging && 'opacity-50 shadow-lg'
            )}
        >
            {/* Drag Handle */}
            <GripVertical
                className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing"
                {...attributes}
                {...listeners}
            />

            {/* Token Display */}
            <div className="flex items-center gap-2">
                {token.type === 'prefix' && (
                    <span className="font-mono text-lg font-bold">{token.value}</span>
                )}

                {token.type === 'wrapper' && (
                    <span className="font-mono text-base text-muted-foreground">
                        {(token.value as [string, string])[0]}&nbsp;...&nbsp;{(token.value as [string, string])[1]}
                    </span>
                )}

                {token.type === 'separator' && (
                    <span className="font-mono text-lg font-semibold text-primary">
                        {token.value as string}
                    </span>
                )}

                {token.type === 'capture' && (
                    <Badge variant={token.captureAs === 'kind' ? 'default' : 'secondary'}>
                        {token.captureAs?.toUpperCase() || 'CAPTURE'}
                    </Badge>
                )}

                {token.type === 'literal' && (
                    <Popover open={isEditing} onOpenChange={setIsEditing}>
                        <PopoverTrigger asChild>
                            <span className="font-semibold cursor-pointer hover:text-primary">
                                "{token.value}"
                            </span>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-3">
                            <Input
                                value={token.value as string}
                                onChange={(e) => onUpdate({ value: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') setIsEditing(false);
                                }}
                                autoFocus
                            />
                        </PopoverContent>
                    </Popover>
                )}

                {token.optional && (
                    <Badge variant="outline" className="text-[10px] px-1">optional</Badge>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 ml-2 border-l pl-2">
                {token.type === 'capture' && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Settings className="h-3 w-3" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-3 space-y-3">
                            <div>
                                <Label className="text-xs mb-1">Capture As</Label>
                                <Select
                                    value={token.captureAs}
                                    onValueChange={(v) => onUpdate({ captureAs: v as CaptureRole })}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="kind">Entity Type</SelectItem>
                                        <SelectItem value="label">Content</SelectItem>
                                        <SelectItem value="subtype">Subtype</SelectItem>
                                        <SelectItem value="attributes">Attributes</SelectItem>
                                        <SelectItem value="target">Target</SelectItem>
                                        <SelectItem value="displayText">Display Text</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Optional</Label>
                                <Switch
                                    checked={token.optional || false}
                                    onCheckedChange={(optional) => onUpdate({ optional })}
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                )}

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                    onClick={onRemove}
                >
                    <X className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}
