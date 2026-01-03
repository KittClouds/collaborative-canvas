import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue } from 'jotai';
import {
    Sparkles,
    Minimize2,
    Expand,
    Check,
    ArrowRight,
    MoreHorizontal,
    Loader2,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { editorInstanceAtom } from '@/atoms/editorAtoms';
import { useAIInlineEdit, AIEditAction } from '@/hooks/useAIInlineEdit';

/**
 * AI-powered floating menu that appears on text selection.
 * Uses React Portal to render outside editor DOM to avoid conflicts.
 * Stays visible until clicking outside of it.
 */
export function AIBubbleMenu() {
    const editor = useAtomValue(editorInstanceAtom);
    const [customPromptOpen, setCustomPromptOpen] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // Store the selection range so we can use it even after blur
    const selectionRef = useRef<{ from: number; to: number } | null>(null);

    const {
        runEdit,
        cancel,
        isLoading,
        streamingText
    } = useAIInlineEdit({
        editor,
        onComplete: () => {
            setCustomPromptOpen(false);
            setCustomPrompt('');
            setVisible(false);
            selectionRef.current = null;
        },
        onError: (error) => {
            console.error('AI edit error:', error);
        },
    });

    // Show menu when there's a selection
    useEffect(() => {
        if (!editor?.view) return;

        const updateMenu = () => {
            // Guard against destroyed view
            if (!editor?.view?.dom) {
                return;
            }

            const { from, to, empty } = editor.state.selection;

            // Only show when there's a non-empty text selection
            if (empty || from === to) {
                // Don't hide here - we hide on click outside
                return;
            }

            // Don't show if selection is in a code block
            if (editor.isActive('codeBlock')) {
                return;
            }

            try {
                // Store selection for later use
                selectionRef.current = { from, to };

                // Get selection coordinates
                const coords = editor.view.coordsAtPos(from);

                // Position above the selection (offset for the default bubble menu)
                setPosition({
                    top: coords.top - 90, // Above the default menu
                    left: coords.left,
                });
                setVisible(true);
            } catch (e) {
                // coordsAtPos can throw if view is destroyed
            }
        };

        // Listen for selection changes
        editor.on('selectionUpdate', updateMenu);

        return () => {
            editor.off('selectionUpdate', updateMenu);
        };
    }, [editor]);

    // Click outside to close
    useEffect(() => {
        if (!visible) return;

        const handleClickOutside = (e: MouseEvent) => {
            // Check if click is inside the menu
            if (menuRef.current && menuRef.current.contains(e.target as Node)) {
                return; // Don't close
            }

            // Check if click is inside a dropdown (they portal to body too)
            const target = e.target as HTMLElement;
            if (target.closest('[role="menu"]') || target.closest('[data-radix-popper-content-wrapper]')) {
                return; // Don't close - clicking in dropdown
            }

            // Click was outside - close the menu
            setVisible(false);
            selectionRef.current = null;
        };

        // Use mousedown so we catch it before any blur
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [visible]);

    // Focus input when custom prompt opens
    useEffect(() => {
        if (customPromptOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [customPromptOpen]);

    const handleAction = useCallback((action: AIEditAction) => {
        runEdit({ action });
    }, [runEdit]);

    const handleCustomPrompt = useCallback(() => {
        if (customPrompt.trim()) {
            runEdit({ action: 'custom', customPrompt });
            setCustomPromptOpen(false);
        }
    }, [runEdit, customPrompt]);

    const handleClose = useCallback(() => {
        setVisible(false);
        selectionRef.current = null;
    }, []);

    if (!editor?.view || !visible) return null;

    // Render via Portal to document.body to avoid DOM conflicts
    return createPortal(
        <div
            ref={menuRef}
            className={cn(
                "fixed z-[9999] flex items-center gap-0.5 p-1 rounded-lg border bg-popover shadow-lg",
                "animate-in fade-in-0 zoom-in-95 duration-150"
            )}
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
            }}
        >
            {isLoading ? (
                // Loading state
                <div className="flex items-center gap-2 px-3 py-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">
                        {streamingText ? 'Generating...' : 'Thinking...'}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={cancel}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            ) : customPromptOpen ? (
                // Custom prompt input
                <div className="flex items-center gap-2 p-1">
                    <Input
                        ref={inputRef}
                        placeholder="Custom prompt..."
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleCustomPrompt();
                            }
                            if (e.key === 'Escape') {
                                setCustomPromptOpen(false);
                            }
                        }}
                        className="h-7 w-48 text-xs"
                    />
                    <Button
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={handleCustomPrompt}
                        disabled={!customPrompt.trim()}
                    >
                        Apply
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setCustomPromptOpen(false)}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            ) : (
                // Action buttons
                <>
                    {/* AI indicator */}
                    <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary">
                        <Sparkles className="h-3 w-3" />
                        <span>AI</span>
                    </div>

                    <div className="w-px h-4 bg-border mx-0.5" />

                    {/* Quick actions */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleAction('improve')}
                    >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Improve
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleAction('shorten')}
                    >
                        <Minimize2 className="h-3 w-3 mr-1" />
                        Shorten
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleAction('fix')}
                    >
                        <Check className="h-3 w-3 mr-1" />
                        Fix
                    </Button>

                    {/* More dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleAction('lengthen')}>
                                <Expand className="h-3.5 w-3.5 mr-2" />
                                Lengthen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAction('continue')}>
                                <ArrowRight className="h-3.5 w-3.5 mr-2" />
                                Continue
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={(e) => {
                                e.preventDefault();
                                setCustomPromptOpen(true);
                            }}>
                                <Sparkles className="h-3.5 w-3.5 mr-2" />
                                Custom Prompt...
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Close button */}
                    <div className="w-px h-4 bg-border mx-0.5" />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleClose}
                        title="Close"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </>
            )}
        </div>,
        document.body
    );
}

export default AIBubbleMenu;
