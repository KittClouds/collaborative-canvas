import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface EditableTagsProps {
    value: string[];
    onChange: (value: string[]) => void;
    label?: string;
    suggestions?: string[];
    maxTags?: number;
    allowCustom?: boolean;
    color?: string;
    placeholder?: string;
    className?: string;
}

export function EditableTags({
    value = [],
    onChange,
    label,
    suggestions = [],
    maxTags,
    allowCustom = true,
    color,
    placeholder = 'Add tag...',
    className,
}: EditableTagsProps) {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const canAddMore = maxTags === undefined || value.length < maxTags;

    // Filter suggestions based on input and already selected tags
    const filteredSuggestions = suggestions.filter(
        (s) =>
            !value.includes(s) &&
            s.toLowerCase().includes(inputValue.toLowerCase())
    );

    const addTag = useCallback(
        (tag: string) => {
            const trimmed = tag.trim();
            if (trimmed && !value.includes(trimmed) && canAddMore) {
                onChange([...value, trimmed]);
                setInputValue('');
            }
        },
        [value, onChange, canAddMore]
    );

    const removeTag = useCallback(
        (index: number) => {
            const newTags = [...value];
            newTags.splice(index, 1);
            onChange(newTags);
        },
        [value, onChange]
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && inputValue.trim()) {
                e.preventDefault();
                if (allowCustom || suggestions.includes(inputValue.trim())) {
                    addTag(inputValue);
                }
            } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
                removeTag(value.length - 1);
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
                inputRef.current?.blur();
            }
        },
        [inputValue, value, addTag, removeTag, allowCustom, suggestions]
    );

    return (
        <div className={cn('space-y-1', className)}>
            {label && (
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
            )}

            <div
                className={cn(
                    'flex flex-wrap items-center gap-1 p-2 min-h-[40px]',
                    'rounded-md border border-input bg-background/50',
                    'focus-within:ring-1 focus-within:ring-ring'
                )}
                onClick={() => inputRef.current?.focus()}
            >
                {/* Tags */}
                {value.map((tag, index) => (
                    <Badge
                        key={`${tag}-${index}`}
                        variant="secondary"
                        className={cn(
                            'gap-1 pr-1 hover:bg-secondary',
                            color && 'text-white'
                        )}
                        style={color ? { backgroundColor: color } : undefined}
                    >
                        {tag}
                        <button
                            type="button"
                            className="ml-1 rounded-full hover:bg-black/20 p-0.5"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeTag(index);
                            }}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}

                {/* Input */}
                {canAddMore && (
                    <div className="relative flex-1 min-w-[100px]">
                        <Input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                            placeholder={value.length === 0 ? placeholder : ''}
                            className="h-6 border-0 p-0 shadow-none focus-visible:ring-0 text-sm bg-transparent"
                        />

                        {/* Suggestions dropdown */}
                        {showSuggestions && filteredSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg max-h-[150px] overflow-auto">
                                {filteredSuggestions.slice(0, 10).map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        type="button"
                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted transition-colors"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            addTag(suggestion);
                                        }}
                                    >
                                        <Plus className="h-3 w-3 inline mr-2 text-muted-foreground" />
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Count indicator */}
            {maxTags !== undefined && (
                <div className="text-[10px] text-muted-foreground/60 text-right">
                    {value.length}/{maxTags}
                </div>
            )}
        </div>
    );
}
