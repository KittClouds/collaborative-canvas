import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Bold, Italic, Underline, Link, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';

type ToolbarItem = 'bold' | 'italic' | 'underline' | 'link' | 'list';

interface EditableRichTextProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    minHeight?: number;
    maxHeight?: number;
    toolbar?: ToolbarItem[];
    placeholder?: string;
    className?: string;
}

const TOOLBAR_ICONS: Record<ToolbarItem, typeof Bold> = {
    bold: Bold,
    italic: Italic,
    underline: Underline,
    link: Link,
    list: List,
};

const TOOLBAR_COMMANDS: Record<ToolbarItem, string> = {
    bold: 'bold',
    italic: 'italic',
    underline: 'underline',
    link: 'createLink',
    list: 'insertUnorderedList',
};

export function EditableRichText({
    value,
    onChange,
    label,
    minHeight = 80,
    maxHeight = 200,
    toolbar = ['bold', 'italic', 'underline'],
    placeholder = 'Enter text...',
    className,
}: EditableRichTextProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Sync value to editor
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const handleInput = useCallback(() => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    }, [onChange]);

    const execCommand = useCallback((command: string) => {
        if (command === 'createLink') {
            const url = prompt('Enter URL:');
            if (url) {
                document.execCommand('createLink', false, url);
            }
        } else {
            document.execCommand(command, false);
        }
        editorRef.current?.focus();
    }, []);

    const isCommandActive = useCallback((command: string) => {
        try {
            return document.queryCommandState(command);
        } catch {
            return false;
        }
    }, []);

    return (
        <div className={cn('space-y-1', className)}>
            {label && (
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
            )}

            <div
                className={cn(
                    'rounded-md border border-input bg-background/50 overflow-hidden transition-colors',
                    isFocused && 'ring-1 ring-ring border-ring'
                )}
            >
                {/* Toolbar */}
                {toolbar.length > 0 && (
                    <div className="flex items-center gap-0.5 p-1 border-b border-border/50 bg-muted/30">
                        {toolbar.map((item) => {
                            const Icon = TOOLBAR_ICONS[item];
                            const command = TOOLBAR_COMMANDS[item];

                            return (
                                <Toggle
                                    key={item}
                                    size="sm"
                                    pressed={isCommandActive(command)}
                                    onPressedChange={() => execCommand(command)}
                                    className="h-7 w-7 p-0"
                                >
                                    <Icon className="h-4 w-4" />
                                </Toggle>
                            );
                        })}
                    </div>
                )}

                {/* Editor */}
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={handleInput}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    data-placeholder={placeholder}
                    className={cn(
                        'p-2 text-sm focus:outline-none overflow-y-auto',
                        'prose prose-sm prose-invert max-w-none',
                        '[&:empty]:before:content-[attr(data-placeholder)]',
                        '[&:empty]:before:text-muted-foreground/50',
                        '[&:empty]:before:pointer-events-none'
                    )}
                    style={{
                        minHeight: `${minHeight}px`,
                        maxHeight: `${maxHeight}px`,
                    }}
                    dangerouslySetInnerHTML={{ __html: value || '' }}
                />
            </div>
        </div>
    );
}
