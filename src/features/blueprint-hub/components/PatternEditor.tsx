/**
 * PatternEditor - Create/Edit regex patterns
 * 
 * Supports two modes:
 * 1. Visual Builder: Dropdown-based token composition
 * 2. Advanced: Raw regex editing
 */

import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle2, Plus, X, Blocks, Code } from 'lucide-react';
import { validatePatternSyntax, type PatternDefinition, type RefKind, type CaptureMapping } from '@/lib/refs';
import { PatternBuilder } from './pattern-builder';
import type { TokenPatternDefinition } from './pattern-builder';

interface PatternEditorProps {
    pattern: PatternDefinition;
    isNew: boolean;
    onSave: (pattern: PatternDefinition) => void;
    onCancel: () => void;
}

const REF_KINDS: RefKind[] = ['entity', 'wikilink', 'backlink', 'tag', 'mention', 'triple', 'temporal', 'custom'];

export function PatternEditor({ pattern, isNew, onSave, onCancel }: PatternEditorProps) {
    const [mode, setMode] = useState<'builder' | 'advanced'>('builder');
    const [draft, setDraft] = useState<PatternDefinition>({ ...pattern });
    const [captureKeys, setCaptureKeys] = useState<string[]>(Object.keys(pattern.captures));
    const [newCaptureKey, setNewCaptureKey] = useState('');

    // Token-based pattern for the visual builder
    const [tokenPattern, setTokenPattern] = useState<TokenPatternDefinition>({
        id: pattern.id,
        name: pattern.name,
        description: pattern.description,
        kind: pattern.kind,
        enabled: pattern.enabled,
        priority: pattern.priority,
        tokens: [],
        compiledPattern: pattern.pattern,
    });

    // Validate pattern regex
    const validation = useMemo(() => {
        if (!draft.pattern) {
            return { valid: false, error: 'Pattern is required' };
        }
        return validatePatternSyntax(draft.pattern, draft.flags);
    }, [draft.pattern, draft.flags]);

    // Count capture groups in pattern
    const captureGroupCount = useMemo(() => {
        try {
            // Count unescaped parentheses (rough estimate)
            const matches = draft.pattern.match(/\((?!\?)/g);
            return matches ? matches.length : 0;
        } catch {
            return 0;
        }
    }, [draft.pattern]);

    const handleSave = () => {
        if (mode === 'builder') {
            // Save from visual builder
            const finalPattern: PatternDefinition = {
                ...draft,
                name: tokenPattern.name,
                description: tokenPattern.description,
                kind: tokenPattern.kind as RefKind,
                enabled: tokenPattern.enabled,
                priority: tokenPattern.priority,
                pattern: tokenPattern.compiledPattern || '',
            };
            onSave(finalPattern);
        } else {
            // Save from advanced mode
            if (!validation.valid) return;
            onSave(draft);
        }
    };

    const handleTokenPatternChange = (updated: TokenPatternDefinition) => {
        setTokenPattern(updated);
        // Sync to draft for validation
        setDraft(prev => ({
            ...prev,
            name: updated.name,
            description: updated.description,
            kind: updated.kind as RefKind,
            enabled: updated.enabled,
            priority: updated.priority,
            pattern: updated.compiledPattern || '',
        }));
    };

    const updateCapture = (key: string, updates: Partial<CaptureMapping>) => {
        setDraft(prev => ({
            ...prev,
            captures: {
                ...prev.captures,
                [key]: { ...prev.captures[key], ...updates },
            },
        }));
    };

    const addCapture = () => {
        if (!newCaptureKey || captureKeys.includes(newCaptureKey)) return;
        setCaptureKeys([...captureKeys, newCaptureKey]);
        setDraft(prev => ({
            ...prev,
            captures: {
                ...prev.captures,
                [newCaptureKey]: { group: captureKeys.length + 1 },
            },
        }));
        setNewCaptureKey('');
    };

    const removeCapture = (key: string) => {
        setCaptureKeys(captureKeys.filter(k => k !== key));
        setDraft(prev => {
            const { [key]: _, ...rest } = prev.captures;
            return { ...prev, captures: rest };
        });
    };

    const canSave = mode === 'builder'
        ? (tokenPattern.compiledPattern && tokenPattern.name)
        : validation.valid;

    return (
        <Dialog open onOpenChange={() => onCancel()}>
            <DialogContent className="max-w-3xl max-h-[90vh]">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle>{isNew ? 'Create Pattern' : 'Edit Pattern'}</DialogTitle>
                            <DialogDescription>
                                {isNew
                                    ? 'Define a new pattern for detecting references in your notes.'
                                    : `Editing pattern: ${pattern.name}`}
                            </DialogDescription>
                        </div>

                        {/* Mode Toggle */}
                        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                            <Button
                                variant={mode === 'builder' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setMode('builder')}
                                className="gap-1.5"
                            >
                                <Blocks className="h-4 w-4" />
                                Builder
                            </Button>
                            <Button
                                variant={mode === 'advanced' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setMode('advanced')}
                                className="gap-1.5"
                            >
                                <Code className="h-4 w-4" />
                                Advanced
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] pr-4">
                    {mode === 'builder' ? (
                        <PatternBuilder
                            pattern={tokenPattern}
                            onChange={handleTokenPatternChange}
                        />
                    ) : (
                        <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="mb-4">
                                <TabsTrigger value="basic">Basic</TabsTrigger>
                                <TabsTrigger value="captures">Captures</TabsTrigger>
                                <TabsTrigger value="rendering">Rendering</TabsTrigger>
                            </TabsList>

                            <TabsContent value="basic" className="space-y-4">
                                {/* Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        value={draft.name}
                                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                        placeholder="My Pattern"
                                    />
                                </div>

                                {/* Description */}
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Input
                                        id="description"
                                        value={draft.description || ''}
                                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                                        placeholder="What does this pattern match?"
                                    />
                                </div>

                                {/* Kind & Priority */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Kind</Label>
                                        <Select
                                            value={draft.kind}
                                            onValueChange={(value: RefKind) => setDraft({ ...draft, kind: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {REF_KINDS.map(kind => (
                                                    <SelectItem key={kind} value={kind} className="capitalize">
                                                        {kind}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="priority">Priority (higher = first)</Label>
                                        <Input
                                            id="priority"
                                            type="number"
                                            value={draft.priority}
                                            onChange={(e) => setDraft({ ...draft, priority: parseInt(e.target.value) || 0 })}
                                            min={0}
                                            max={1000}
                                        />
                                    </div>
                                </div>

                                {/* Regex Pattern */}
                                <div className="space-y-2">
                                    <Label htmlFor="pattern">Regex Pattern</Label>
                                    <Textarea
                                        id="pattern"
                                        value={draft.pattern}
                                        onChange={(e) => setDraft({ ...draft, pattern: e.target.value })}
                                        className="font-mono text-sm"
                                        rows={3}
                                        placeholder="\\[([A-Z_]+)\\|([^\\]]+)\\]"
                                    />
                                    {validation.valid ? (
                                        <div className="flex items-center gap-2 text-sm text-green-600">
                                            <CheckCircle2 className="h-4 w-4" />
                                            Valid pattern ({captureGroupCount} capture groups)
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-sm text-destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            {validation.error}
                                        </div>
                                    )}
                                </div>

                                {/* Flags */}
                                <div className="space-y-2">
                                    <Label htmlFor="flags">Flags</Label>
                                    <Input
                                        id="flags"
                                        value={draft.flags}
                                        onChange={(e) => setDraft({ ...draft, flags: e.target.value })}
                                        placeholder="g, gi, gm"
                                        className="w-24"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        g = global, i = case-insensitive, m = multiline
                                    </p>
                                </div>

                                {/* Enabled */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Enabled</Label>
                                        <p className="text-xs text-muted-foreground">Pattern will be used for detection</p>
                                    </div>
                                    <Switch
                                        checked={draft.enabled}
                                        onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="captures" className="space-y-4">
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        Map capture groups from your regex to named fields. Group numbers are 1-indexed.
                                    </AlertDescription>
                                </Alert>

                                {/* Existing captures */}
                                <div className="space-y-3">
                                    {captureKeys.map(key => (
                                        <div key={key} className="flex items-center gap-3 p-3 border rounded-lg">
                                            <div className="flex-1">
                                                <Label className="text-sm font-medium">{key}</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs text-muted-foreground">Group:</Label>
                                                <Input
                                                    type="number"
                                                    value={draft.captures[key]?.group || 1}
                                                    onChange={(e) => updateCapture(key, { group: parseInt(e.target.value) || 1 })}
                                                    className="w-16 h-8"
                                                    min={1}
                                                    max={10}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={draft.captures[key]?.required || false}
                                                    onCheckedChange={(required) => updateCapture(key, { required })}
                                                />
                                                <Label className="text-xs">Required</Label>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => removeCapture(key)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add new capture */}
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={newCaptureKey}
                                        onChange={(e) => setNewCaptureKey(e.target.value)}
                                        placeholder="Capture name (e.g., 'label')"
                                        className="flex-1"
                                    />
                                    <Button variant="outline" size="sm" onClick={addCapture} disabled={!newCaptureKey}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="rendering" className="space-y-4">
                                {/* Widget Mode */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Widget Mode</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Render as a compact widget instead of inline highlight
                                        </p>
                                    </div>
                                    <Switch
                                        checked={draft.rendering.widgetMode || false}
                                        onCheckedChange={(widgetMode) =>
                                            setDraft({ ...draft, rendering: { ...draft.rendering, widgetMode } })
                                        }
                                    />
                                </div>

                                {/* Color */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="color">Text Color</Label>
                                        <Input
                                            id="color"
                                            value={draft.rendering.color || ''}
                                            onChange={(e) =>
                                                setDraft({ ...draft, rendering: { ...draft.rendering, color: e.target.value } })
                                            }
                                            placeholder="#3b82f6 or hsl(var(--primary))"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="bgColor">Background Color</Label>
                                        <Input
                                            id="bgColor"
                                            value={draft.rendering.backgroundColor || ''}
                                            onChange={(e) =>
                                                setDraft({ ...draft, rendering: { ...draft.rendering, backgroundColor: e.target.value } })
                                            }
                                            placeholder="#3b82f620"
                                        />
                                    </div>
                                </div>

                                {/* Template */}
                                <div className="space-y-2">
                                    <Label htmlFor="template">Display Template</Label>
                                    <Input
                                        id="template"
                                        value={draft.rendering.template || ''}
                                        onChange={(e) =>
                                            setDraft({ ...draft, rendering: { ...draft.rendering, template: e.target.value } })
                                        }
                                        placeholder="{{label}} or {{displayText || target}}"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Use {'{{captureName}}'} to insert captured values
                                    </p>
                                </div>

                                {/* CSS Class */}
                                <div className="space-y-2">
                                    <Label htmlFor="className">CSS Class</Label>
                                    <Input
                                        id="className"
                                        value={draft.rendering.className || ''}
                                        onChange={(e) =>
                                            setDraft({ ...draft, rendering: { ...draft.rendering, className: e.target.value } })
                                        }
                                        placeholder="custom-highlight"
                                    />
                                </div>

                                {/* Preview */}
                                <div className="space-y-2">
                                    <Label>Preview</Label>
                                    <div className="p-4 border rounded-lg bg-muted/30">
                                        <span
                                            style={{
                                                backgroundColor: draft.rendering.backgroundColor || '#3b82f620',
                                                color: draft.rendering.color || '#3b82f6',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontWeight: 500,
                                                fontSize: '0.875em',
                                            }}
                                            className={draft.rendering.className}
                                        >
                                            Example Match
                                        </span>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </ScrollArea>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!canSave}>
                        {isNew ? 'Create Pattern' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
