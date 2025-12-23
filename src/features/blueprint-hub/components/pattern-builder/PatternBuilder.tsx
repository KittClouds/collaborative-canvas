/**
 * PatternBuilder - Main inline pattern builder with unified add menu
 */

import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    horizontalListSortingStrategy,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus as ButtonIcon } from 'lucide-react';
import type { RefKind } from '@/lib/refs';
import { TokenChipInline } from './TokenChipInline';
import { LiveMatchHighlighter } from './LiveMatchHighlighter';
import type { PatternToken, TokenPatternDefinition } from './types';
import { compileTokensToRegex, renderPatternExample } from './types';

interface PatternBuilderProps {
    pattern: TokenPatternDefinition;
    onChange: (pattern: TokenPatternDefinition) => void;
    onRequestAddToken: () => void;
}

const REF_KINDS: RefKind[] = ['entity', 'wikilink', 'backlink', 'tag', 'mention', 'triple', 'temporal', 'custom'];

export function PatternBuilder({ pattern, onChange, onRequestAddToken }: PatternBuilderProps) {
    const [tokens, setTokens] = useState<PatternToken[]>(pattern.tokens || []);
    const [testInput, setTestInput] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Auto-compile on token change
    useEffect(() => {
        const compiled = compileTokensToRegex(tokens);
        onChange({ ...pattern, tokens, compiledPattern: compiled });
    }, [tokens]);



    const removeToken = (id: string) => {
        setTokens(tokens.filter((t) => t.id !== id));
    };

    const updateToken = (id: string, updates: Partial<PatternToken>) => {
        setTokens(tokens.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setTokens((items) => {
                const oldIndex = items.findIndex((t) => t.id === active.id);
                const newIndex = items.findIndex((t) => t.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const examplePattern = renderPatternExample(tokens);

    return (
        <div className="space-y-6">
            {/* Header Row */}
            <div className="grid grid-cols-[1fr_auto_120px] gap-4">
                <div>
                    <Label>Pattern Name</Label>
                    <Input
                        value={pattern.name}
                        onChange={(e) => onChange({ ...pattern, name: e.target.value })}
                        placeholder="My Custom Pattern"
                    />
                </div>

                <div>
                    <Label>Kind</Label>
                    <Select
                        value={pattern.kind}
                        onValueChange={(kind) => onChange({ ...pattern, kind })}
                    >
                        <SelectTrigger className="w-[140px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {REF_KINDS.map((kind) => (
                                <SelectItem key={kind} value={kind} className="capitalize">
                                    {kind}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>Priority</Label>
                    <Input
                        type="number"
                        value={pattern.priority}
                        onChange={(e) => onChange({ ...pattern, priority: +e.target.value })}
                        min={0}
                        max={1000}
                    />
                </div>
            </div>

            <div>
                <Label>Description</Label>
                <Input
                    value={pattern.description || ''}
                    onChange={(e) => onChange({ ...pattern, description: e.target.value })}
                    placeholder="What does this pattern match?"
                />
            </div>

            {/* PATTERN CANVAS - Main Building Area */}
            <div>
                <Label className="mb-3 block text-base font-semibold">Pattern Structure</Label>

                <div className="border-2 border-dashed rounded-lg p-6 min-h-[140px] bg-muted/30">
                    {tokens.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-muted-foreground mb-3">
                                Add tokens to build your pattern
                            </div>
                            <div className="text-sm text-muted-foreground/60">
                                Example: <span className="font-mono bg-background px-2 py-1 rounded">[CHARACTER|Jon]</span>
                            </div>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={tokens.map((t) => t.id)}
                                strategy={horizontalListSortingStrategy}
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    {tokens.map((token, idx) => (
                                        <TokenChipInline
                                            key={token.id}
                                            token={token}
                                            index={idx}
                                            onUpdate={(updates) => updateToken(token.id, updates)}
                                            onRemove={() => removeToken(token.id)}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>

                {/* ADD TOKEN BUTTON */}
                <div className="mt-3">
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={onRequestAddToken}
                    >
                        <ButtonIcon className="w-4 h-4 mr-2" />
                        Add Token
                    </Button>
                </div>
            </div>

            {/* PREVIEW */}
            {examplePattern && (
                <div>
                    <Label className="mb-2 block">Preview</Label>
                    <div className="bg-background border rounded-lg p-4">
                        <div className="text-sm text-muted-foreground mb-1">Your pattern will match:</div>
                        <div className="font-mono text-lg">{examplePattern}</div>
                    </div>
                </div>
            )}

            {/* TEST AREA */}
            <div>
                <Label className="mb-2 block">Test Pattern</Label>
                <Textarea
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Type some text to test your pattern..."
                    rows={4}
                    className="font-mono"
                />
                <LiveMatchHighlighter tokens={tokens} input={testInput} />
            </div>

            {/* Advanced: Show compiled regex */}
            <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Show compiled regex (advanced)
                </summary>
                <pre className="bg-muted p-3 rounded mt-2 text-xs font-mono overflow-x-auto">
                    {pattern.compiledPattern || 'No pattern yet'}
                </pre>
            </details>

            {/* ENABLE TOGGLE */}
            <div className="flex items-center justify-between pt-4 border-t">
                <div>
                    <Label className="text-base">Enabled</Label>
                    <p className="text-sm text-muted-foreground">Pattern will be used for detection</p>
                </div>
                <Switch
                    checked={pattern.enabled}
                    onCheckedChange={(enabled) => onChange({ ...pattern, enabled })}
                />
            </div>
        </div>
    );
}
