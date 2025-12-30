/**
 * TimelineEditor - Unified sidebar editor for Periods and Events
 * Displays hierarchical tree view of Epochs → Eras → Events
 */

"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight,
    ChevronDown,
    Plus,
    Trash2,
    Edit3,
    Calendar,
    Clock,
    Layers,
    Sparkles
} from 'lucide-react';
import { useCalendarContext } from '@/contexts/CalendarContext';
import { Period, CalendarEvent, PeriodType } from '@/lib/fantasy-calendar/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Period type colors
const PERIOD_TYPE_COLORS: Record<PeriodType, string> = {
    epoch: '#8b5cf6',   // violet
    era: '#3b82f6',     // blue
    age: '#10b981',     // emerald
    custom: '#f59e0b',  // amber
};

// Period type icons
const PERIOD_TYPE_ICONS: Record<PeriodType, typeof Layers> = {
    epoch: Sparkles,
    era: Layers,
    age: Clock,
    custom: Calendar,
};

interface PeriodFormData {
    name: string;
    periodType: PeriodType;
    startYear: number;
    endYear?: number;
    description?: string;
    parentPeriodId?: string;
}

// Add/Edit Period Dialog
function PeriodDialog({
    open,
    onOpenChange,
    initialData,
    parentPeriodId,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: Period;
    parentPeriodId?: string;
    onSubmit: (data: PeriodFormData) => void;
}) {
    const { periods } = useCalendarContext();
    const [formData, setFormData] = useState<PeriodFormData>({
        name: initialData?.name || '',
        periodType: initialData?.periodType || (parentPeriodId ? 'era' : 'epoch'),
        startYear: initialData?.startYear || 1,
        endYear: initialData?.endYear,
        description: initialData?.description || '',
        parentPeriodId: initialData?.parentPeriodId || parentPeriodId,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {initialData ? 'Edit Period' : 'New Period'}
                    </DialogTitle>
                    <DialogDescription>
                        Create an era, epoch, or age to organize your timeline.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Period Name</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Age of Myth"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                                value={formData.periodType}
                                onValueChange={(v) => setFormData(prev => ({ ...prev, periodType: v as PeriodType }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="epoch">Epoch (largest)</SelectItem>
                                    <SelectItem value="era">Era</SelectItem>
                                    <SelectItem value="age">Age</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {!parentPeriodId && (
                            <div className="space-y-2">
                                <Label>Parent Period</Label>
                                <Select
                                    value={formData.parentPeriodId || 'none'}
                                    onValueChange={(v) => setFormData(prev => ({ ...prev, parentPeriodId: v === 'none' ? undefined : v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="None (root)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None (root)</SelectItem>
                                        {periods.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startYear">Start Year</Label>
                            <Input
                                id="startYear"
                                type="number"
                                value={formData.startYear}
                                onChange={(e) => setFormData(prev => ({ ...prev, startYear: parseInt(e.target.value) || 1 }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endYear">End Year (optional)</Label>
                            <Input
                                id="endYear"
                                type="number"
                                value={formData.endYear || ''}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    endYear: e.target.value ? parseInt(e.target.value) : undefined
                                }))}
                                placeholder="Ongoing"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            {initialData ? 'Save Changes' : 'Create Period'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// Single Period Item in the tree
function PeriodItem({
    period,
    depth = 0,
}: {
    period: Period;
    depth?: number;
}) {
    const {
        getChildPeriods,
        getEventsInPeriod,
        removePeriod,
        updatePeriod,
        addPeriod,
    } = useCalendarContext();

    const [isOpen, setIsOpen] = useState(true);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [addChildDialogOpen, setAddChildDialogOpen] = useState(false);

    const childPeriods = getChildPeriods(period.id);
    const events = getEventsInPeriod(period.id);
    const hasChildren = childPeriods.length > 0 || events.length > 0;

    const Icon = PERIOD_TYPE_ICONS[period.periodType];
    const color = period.color || PERIOD_TYPE_COLORS[period.periodType];

    const handleEditSubmit = (data: PeriodFormData) => {
        updatePeriod(period.id, {
            name: data.name,
            periodType: data.periodType,
            startYear: data.startYear,
            endYear: data.endYear,
            description: data.description,
            parentPeriodId: data.parentPeriodId,
        });
    };

    const handleAddChild = (data: PeriodFormData) => {
        addPeriod({
            ...data,
            color: PERIOD_TYPE_COLORS[data.periodType],
            parentPeriodId: period.id,
        });
    };

    return (
        <div className="select-none">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <div
                    className={cn(
                        "group flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors",
                        "border-l-2"
                    )}
                    style={{
                        marginLeft: depth * 16,
                        borderLeftColor: color,
                    }}
                >
                    {hasChildren ? (
                        <CollapsibleTrigger asChild>
                            <button className="p-0.5 hover:bg-muted rounded">
                                {isOpen ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                )}
                            </button>
                        </CollapsibleTrigger>
                    ) : (
                        <span className="w-4" />
                    )}

                    <Icon className="w-4 h-4" style={{ color }} />

                    <span className="flex-1 text-sm font-medium truncate">
                        {period.name}
                    </span>

                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {period.startYear}–{period.endYear || 'now'}
                    </Badge>

                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => setAddChildDialogOpen(true)}
                            className="p-1 hover:bg-muted rounded"
                            title="Add nested period"
                        >
                            <Plus className="w-3 h-3 text-muted-foreground" />
                        </button>
                        <button
                            onClick={() => setEditDialogOpen(true)}
                            className="p-1 hover:bg-muted rounded"
                            title="Edit period"
                        >
                            <Edit3 className="w-3 h-3 text-muted-foreground" />
                        </button>
                        <button
                            onClick={() => removePeriod(period.id)}
                            className="p-1 hover:bg-destructive/20 rounded"
                            title="Delete period"
                        >
                            <Trash2 className="w-3 h-3 text-destructive" />
                        </button>
                    </div>
                </div>

                <CollapsibleContent>
                    <AnimatePresence>
                        {/* Child periods */}
                        {childPeriods.map(child => (
                            <motion.div
                                key={child.id}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <PeriodItem period={child} depth={depth + 1} />
                            </motion.div>
                        ))}

                        {/* Events in this period */}
                        {events.map(event => (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-2 py-1 px-2 ml-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                style={{ marginLeft: (depth + 1) * 16 + 16 }}
                            >
                                <Calendar className="w-3 h-3" />
                                <span className="truncate">{event.title}</span>
                                <span className="text-xs opacity-60">
                                    Year {event.date.year}
                                </span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </CollapsibleContent>
            </Collapsible>

            <PeriodDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                initialData={period}
                onSubmit={handleEditSubmit}
            />

            <PeriodDialog
                open={addChildDialogOpen}
                onOpenChange={setAddChildDialogOpen}
                parentPeriodId={period.id}
                onSubmit={handleAddChild}
            />
        </div>
    );
}

// Main TimelineEditor component
export function TimelineEditor({ className }: { className?: string }) {
    const { periods, getRootPeriods, addPeriod } = useCalendarContext();
    const [addDialogOpen, setAddDialogOpen] = useState(false);

    const rootPeriods = getRootPeriods();

    const handleAddRootPeriod = (data: PeriodFormData) => {
        addPeriod({
            ...data,
            color: PERIOD_TYPE_COLORS[data.periodType],
        });
    };

    return (
        <div className={cn("space-y-3", className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">Timeline Periods</h3>
                </div>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAddDialogOpen(true)}
                    className="h-7 px-2"
                >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add
                </Button>
            </div>

            {/* Period Tree */}
            <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                {rootPeriods.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No periods yet</p>
                        <p className="text-xs">Create an epoch or era to organize your timeline</p>
                    </div>
                ) : (
                    rootPeriods.map(period => (
                        <PeriodItem key={period.id} period={period} />
                    ))
                )}
            </div>

            {/* Quick Stats */}
            {periods.length > 0 && (
                <div className="flex gap-2 pt-2 border-t">
                    <Badge variant="secondary" className="text-xs">
                        {periods.filter(p => p.periodType === 'epoch').length} Epochs
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                        {periods.filter(p => p.periodType === 'era').length} Eras
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                        {periods.filter(p => p.periodType === 'age').length} Ages
                    </Badge>
                </div>
            )}

            <PeriodDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onSubmit={handleAddRootPeriod}
            />
        </div>
    );
}

export default TimelineEditor;
