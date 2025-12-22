/**
 * PatternManager - UI for managing regex patterns
 * 
 * Lists all patterns (built-in + custom), allows toggling, editing, and testing.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, MoreVertical, Pencil, Trash2, RotateCcw, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { patternRegistry, type PatternDefinition, type RefKind } from '@/lib/refs';
import { PatternEditor } from './PatternEditor';
import { PatternTester } from './RefPatternTester';

// Kind badges colors
const KIND_COLORS: Record<RefKind, string> = {
    entity: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
    wikilink: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
    backlink: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
    tag: 'bg-sky-500/20 text-sky-600 border-sky-500/30',
    mention: 'bg-violet-500/20 text-violet-600 border-violet-500/30',
    triple: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
    temporal: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
    custom: 'bg-gray-500/20 text-gray-600 border-gray-500/30',
};

interface PatternCardProps {
    pattern: PatternDefinition;
    onToggle: (id: string, enabled: boolean) => void;
    onEdit: (pattern: PatternDefinition) => void;
    onDelete: (id: string) => void;
    onTest: (pattern: PatternDefinition) => void;
}

function PatternCard({ pattern, onToggle, onEdit, onDelete, onTest }: PatternCardProps) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    return (
        <>
            <Card className={cn(
                'transition-all duration-200',
                !pattern.enabled && 'opacity-60'
            )}>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-medium">{pattern.name}</CardTitle>
                            <Badge variant="outline" className={cn('text-xs', KIND_COLORS[pattern.kind])}>
                                {pattern.kind}
                            </Badge>
                            {pattern.isBuiltIn && (
                                <Badge variant="secondary" className="text-xs">Built-in</Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={pattern.enabled}
                                onCheckedChange={(checked) => onToggle(pattern.id, checked)}
                                aria-label={`Toggle ${pattern.name}`}
                            />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => onTest(pattern)}>
                                        <Code2 className="h-4 w-4 mr-2" />
                                        Test Pattern
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onEdit(pattern)}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Edit
                                    </DropdownMenuItem>
                                    {!pattern.isBuiltIn && (
                                        <DropdownMenuItem
                                            onClick={() => setDeleteDialogOpen(true)}
                                            className="text-destructive focus:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                    {pattern.description && (
                        <CardDescription className="text-xs">{pattern.description}</CardDescription>
                    )}
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Priority: {pattern.priority}</span>
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] max-w-[200px] truncate">
                            {pattern.pattern}
                        </span>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Pattern</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{pattern.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                onDelete(pattern.id);
                                setDeleteDialogOpen(false);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export function PatternManager() {
    const [patterns, setPatterns] = useState<PatternDefinition[]>(() =>
        patternRegistry.getAllPatterns()
    );
    const [editingPattern, setEditingPattern] = useState<PatternDefinition | null>(null);
    const [testingPattern, setTestingPattern] = useState<PatternDefinition | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Refresh patterns from registry
    const refreshPatterns = useCallback(() => {
        setPatterns(patternRegistry.getAllPatterns());
    }, []);

    // Group patterns by kind
    const groupedPatterns = useMemo(() => {
        const groups: Record<string, PatternDefinition[]> = {};
        for (const pattern of patterns) {
            if (!groups[pattern.kind]) {
                groups[pattern.kind] = [];
            }
            groups[pattern.kind].push(pattern);
        }
        // Sort each group by priority
        for (const kind of Object.keys(groups)) {
            groups[kind].sort((a, b) => b.priority - a.priority);
        }
        return groups;
    }, [patterns]);

    const handleToggle = useCallback((id: string, enabled: boolean) => {
        patternRegistry.togglePattern(id, enabled);
        refreshPatterns();
    }, [refreshPatterns]);

    const handleSave = useCallback((pattern: PatternDefinition) => {
        patternRegistry.register(pattern);
        refreshPatterns();
        setEditingPattern(null);
        setIsCreating(false);
    }, [refreshPatterns]);

    const handleDelete = useCallback((id: string) => {
        patternRegistry.unregister(id);
        refreshPatterns();
    }, [refreshPatterns]);

    const handleReset = useCallback(() => {
        patternRegistry.reset();
        refreshPatterns();
    }, [refreshPatterns]);

    const handleCreateNew = useCallback(() => {
        const newPattern: PatternDefinition = {
            id: `custom:${Date.now()}`,
            name: 'New Pattern',
            description: '',
            kind: 'custom',
            enabled: true,
            priority: 50,
            pattern: '',
            flags: 'g',
            captures: {},
            rendering: {
                widgetMode: false,
            },
            isBuiltIn: false,
            createdAt: Date.now(),
        };
        setEditingPattern(newPattern);
        setIsCreating(true);
    }, []);

    const customPatternCount = patterns.filter(p => !p.isBuiltIn).length;
    const enabledCount = patterns.filter(p => p.enabled).length;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <div>
                    <h2 className="text-lg font-semibold">Pattern Manager</h2>
                    <p className="text-sm text-muted-foreground">
                        {patterns.length} patterns ({enabledCount} enabled, {customPatternCount} custom)
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset to Defaults
                    </Button>
                    <Button size="sm" onClick={handleCreateNew}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Pattern
                    </Button>
                </div>
            </div>

            {/* Pattern List */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                    {Object.entries(groupedPatterns).map(([kind, kindPatterns]) => (
                        <div key={kind}>
                            <h3 className="text-sm font-medium text-muted-foreground mb-3 capitalize">
                                {kind} Patterns
                            </h3>
                            <div className="space-y-2">
                                {kindPatterns.map(pattern => (
                                    <PatternCard
                                        key={pattern.id}
                                        pattern={pattern}
                                        onToggle={handleToggle}
                                        onEdit={setEditingPattern}
                                        onDelete={handleDelete}
                                        onTest={setTestingPattern}
                                    />
                                ))}
                            </div>
                            <Separator className="mt-4" />
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Pattern Editor Dialog */}
            {editingPattern && (
                <PatternEditor
                    pattern={editingPattern}
                    isNew={isCreating}
                    onSave={handleSave}
                    onCancel={() => {
                        setEditingPattern(null);
                        setIsCreating(false);
                    }}
                />
            )}

            {/* Pattern Tester Dialog */}
            {testingPattern && (
                <PatternTester
                    pattern={testingPattern}
                    onClose={() => setTestingPattern(null)}
                />
            )}
        </div>
    );
}
