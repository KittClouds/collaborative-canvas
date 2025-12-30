/**
 * EventDetailPanel - Full event form with all narrative fields
 */

"use client";

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    CalendarEvent,
    NarrativeEventType,
    StoryBeat,
    EntityRef,
    CellDisplayMode
} from '@/lib/fantasy-calendar/types';
import { useCalendarContext } from '@/contexts/CalendarContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { StoryBeatSelector } from './StoryBeatSelector';
import { CausalityGraph } from './CausalityGraph';
import {
    Save, X, ChevronDown,
    Eye, EyeOff, Pin, PinOff,
    Zap, Users, MapPin, Box,
    CheckSquare, Plus, Trash2,
    Link2, GitBranch
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getEventTypeById, getAllEventTypes } from '@/lib/fantasy-calendar/eventTypeRegistry';

interface EventDetailPanelProps {
    event: CalendarEvent;
    onClose: () => void;
    onEventClick?: (eventId: string) => void;
}

// Narrative type definitions
const NARRATIVE_TYPES: { id: NarrativeEventType; label: string; color: string }[] = [
    { id: 'inciting_incident', label: 'Inciting Incident', color: '#ef4444' },
    { id: 'rising_action', label: 'Rising Action', color: '#f97316' },
    { id: 'climax', label: 'Climax', color: '#eab308' },
    { id: 'falling_action', label: 'Falling Action', color: '#22c55e' },
    { id: 'resolution', label: 'Resolution', color: '#14b8a6' },
    { id: 'subplot', label: 'Subplot', color: '#6366f1' },
    { id: 'foreshadowing', label: 'Foreshadowing', color: '#8b5cf6' },
    { id: 'callback', label: 'Callback', color: '#ec4899' },
    { id: 'revelation', label: 'Revelation', color: '#06b6d4' },
];

export function EventDetailPanel({ event, onClose, onEventClick }: EventDetailPanelProps) {
    const {
        updateEvent,
        removeEvent,
        toggleCellVisibility,
        toggleTimelinePin,
        setCellDisplayMode,
        events
    } = useCalendarContext();

    // Local state for editing
    const [editedEvent, setEditedEvent] = useState<CalendarEvent>({ ...event });
    const [hasChanges, setHasChanges] = useState(false);
    const [linkingMode, setLinkingMode] = useState(false);

    const handleChange = useCallback(<K extends keyof CalendarEvent>(
        key: K,
        value: CalendarEvent[K]
    ) => {
        setEditedEvent(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    }, []);

    const handleSave = useCallback(() => {
        const { id, calendarId, ...updates } = editedEvent;
        updateEvent(event.id, updates);
        setHasChanges(false);
    }, [editedEvent, event.id, updateEvent]);

    const handleDelete = useCallback(() => {
        if (confirm('Delete this event?')) {
            removeEvent(event.id);
            onClose();
        }
    }, [event.id, removeEvent, onClose]);

    // Checklist helpers
    const addChecklistItem = useCallback(() => {
        const newItem = { id: crypto.randomUUID(), text: '', completed: false };
        handleChange('checklist', [...(editedEvent.checklist || []), newItem]);
    }, [editedEvent.checklist, handleChange]);

    const updateChecklistItem = useCallback((id: string, updates: Partial<{ text: string; completed: boolean }>) => {
        handleChange('checklist', (editedEvent.checklist || []).map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    }, [editedEvent.checklist, handleChange]);

    const removeChecklistItem = useCallback((id: string) => {
        handleChange('checklist', (editedEvent.checklist || []).filter(item => item.id !== id));
    }, [editedEvent.checklist, handleChange]);

    const eventType = editedEvent.eventTypeId ? getEventTypeById(editedEvent.eventTypeId) : null;
    const allEventTypes = getAllEventTypes();

    return (
        <motion.div
            className="flex flex-col h-full bg-gradient-to-b from-card to-background"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex flex-col overflow-hidden mr-2">
                    <h2 className="text-lg font-semibold truncate">{editedEvent.title || 'Untitled Event'}</h2>
                    {editedEvent.entityId && (
                        <div className="flex items-center gap-1 text-xs text-blue-500 mt-1">
                            <Link2 className="h-3 w-3" />
                            <span>Linked File</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <Button onClick={handleSave} size="sm" className="gap-1">
                            <Save className="h-4 w-4" /> Save
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <Tabs defaultValue="basic" className="p-4">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="basic">Basic</TabsTrigger>
                        <TabsTrigger value="narrative">Narrative</TabsTrigger>
                        <TabsTrigger value="links">Links</TabsTrigger>
                        <TabsTrigger value="display">Display</TabsTrigger>
                    </TabsList>

                    {/* Basic Tab */}
                    <TabsContent value="basic" className="space-y-4 mt-4">
                        {/* Title */}
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={editedEvent.title}
                                onChange={(e) => handleChange('title', e.target.value)}
                                placeholder="Event title..."
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={editedEvent.description || ''}
                                onChange={(e) => handleChange('description', e.target.value)}
                                placeholder="What happens in this event..."
                                className="min-h-[100px]"
                            />
                        </div>

                        {/* Event Type */}
                        <div className="space-y-2">
                            <Label>Event Type</Label>
                            <Select
                                value={editedEvent.eventTypeId || 'none'}
                                onValueChange={(v) => handleChange('eventTypeId', v === 'none' ? undefined : v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {allEventTypes.map(type => (
                                        <SelectItem key={type.id} value={type.id}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Status */}
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={editedEvent.status || 'todo'}
                                onValueChange={(v) => handleChange('status', v as 'todo' | 'in-progress' | 'completed')}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todo">To Do</SelectItem>
                                    <SelectItem value="in-progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Progress */}
                        {editedEvent.status === 'in-progress' && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Progress</Label>
                                    <span className="text-sm text-muted-foreground">{editedEvent.progress || 0}%</span>
                                </div>
                                <Slider
                                    value={[editedEvent.progress || 0]}
                                    onValueChange={([v]) => handleChange('progress', v)}
                                    max={100}
                                    step={5}
                                />
                            </div>
                        )}

                        <Separator />

                        {/* Checklist */}
                        <Collapsible>
                            <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                                <div className="flex items-center gap-2">
                                    <CheckSquare className="h-4 w-4" />
                                    <span className="font-medium">Checklist</span>
                                    {(editedEvent.checklist?.length || 0) > 0 && (
                                        <Badge variant="secondary" className="text-xs">
                                            {editedEvent.checklist?.filter(c => c.completed).length || 0}/{editedEvent.checklist?.length || 0}
                                        </Badge>
                                    )}
                                </div>
                                <ChevronDown className="h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-2 pt-2">
                                {editedEvent.checklist?.map(item => (
                                    <div key={item.id} className="flex items-center gap-2">
                                        <Checkbox
                                            checked={item.completed}
                                            onCheckedChange={(checked) =>
                                                updateChecklistItem(item.id, { completed: !!checked })
                                            }
                                        />
                                        <Input
                                            value={item.text}
                                            onChange={(e) => updateChecklistItem(item.id, { text: e.target.value })}
                                            placeholder="Task..."
                                            className={cn("flex-1 h-8", item.completed && "line-through text-muted-foreground")}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => removeChecklistItem(item.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={addChecklistItem} className="w-full">
                                    <Plus className="h-3 w-3 mr-1" /> Add Item
                                </Button>
                            </CollapsibleContent>
                        </Collapsible>
                    </TabsContent>

                    {/* Narrative Tab */}
                    <TabsContent value="narrative" className="space-y-4 mt-4">
                        {/* Narrative Type */}
                        <div className="space-y-2">
                            <Label>Narrative Type</Label>
                            <Select
                                value={editedEvent.narrativeType || 'none'}
                                onValueChange={(v) => handleChange('narrativeType', v === 'none' ? undefined : v as NarrativeEventType)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select narrative role..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {NARRATIVE_TYPES.map(type => (
                                        <SelectItem key={type.id} value={type.id}>
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: type.color }}
                                                />
                                                {type.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Story Beat */}
                        <div className="space-y-2">
                            <Label>Story Beat (Save the Cat)</Label>
                            <StoryBeatSelector
                                value={editedEvent.storyBeat}
                                onChange={(beat) => handleChange('storyBeat', beat)}
                            />
                        </div>

                        <Separator />

                        {/* Tension */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-1">
                                    <Zap className="h-4 w-4 text-amber-500" />
                                    Dramatic Tension
                                </Label>
                                <span className="text-sm text-muted-foreground">{editedEvent.tension || 0}%</span>
                            </div>
                            <Slider
                                value={[editedEvent.tension || 0]}
                                onValueChange={([v]) => handleChange('tension', v)}
                                max={100}
                                step={5}
                                className="[&>span]:bg-amber-500"
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Calm</span>
                                <span>Moderate</span>
                                <span>Intense</span>
                            </div>
                        </div>

                        {/* Stakes */}
                        <div className="space-y-2">
                            <Label htmlFor="stakes">Stakes</Label>
                            <Input
                                id="stakes"
                                value={editedEvent.stakes || ''}
                                onChange={(e) => handleChange('stakes', e.target.value)}
                                placeholder="What's at risk..."
                            />
                        </div>
                    </TabsContent>

                    {/* Links Tab */}
                    <TabsContent value="links" className="space-y-4 mt-4">
                        {/* Causality Graph */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                                <GitBranch className="h-4 w-4" />
                                Causality
                            </Label>
                            <CausalityGraph
                                event={editedEvent}
                                onEventClick={onEventClick}
                            />
                        </div>

                        <Separator />

                        {/* Entity References */}
                        <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    <span className="font-medium">Participants</span>
                                    <Badge variant="secondary" className="text-xs">
                                        {editedEvent.participants?.length || 0}
                                    </Badge>
                                </div>
                                <ChevronDown className="h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-2">
                                {editedEvent.participants?.length ? (
                                    <div className="space-y-1">
                                        {editedEvent.participants.map(p => (
                                            <div key={p.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                                <span className="text-sm">{p.name}</span>
                                                <Badge variant="outline" className="text-xs">{p.kind}</Badge>
                                                {p.role && <Badge variant="secondary" className="text-xs">{p.role}</Badge>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No participants linked</p>
                                )}
                            </CollapsibleContent>
                        </Collapsible>

                        <Collapsible>
                            <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    <span className="font-medium">Locations</span>
                                    <Badge variant="secondary" className="text-xs">
                                        {editedEvent.locations?.length || 0}
                                    </Badge>
                                </div>
                                <ChevronDown className="h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-2">
                                {editedEvent.locations?.length ? (
                                    <div className="space-y-1">
                                        {editedEvent.locations.map(l => (
                                            <div key={l.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                                <span className="text-sm">{l.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No locations linked</p>
                                )}
                            </CollapsibleContent>
                        </Collapsible>

                        <Collapsible>
                            <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                                <div className="flex items-center gap-2">
                                    <Box className="h-4 w-4" />
                                    <span className="font-medium">Artifacts</span>
                                    <Badge variant="secondary" className="text-xs">
                                        {editedEvent.artifacts?.length || 0}
                                    </Badge>
                                </div>
                                <ChevronDown className="h-4 w-4" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-2">
                                {editedEvent.artifacts?.length ? (
                                    <div className="space-y-1">
                                        {editedEvent.artifacts.map(a => (
                                            <div key={a.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                                                <span className="text-sm">{a.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No artifacts linked</p>
                                )}
                            </CollapsibleContent>
                        </Collapsible>
                    </TabsContent>

                    {/* Display Tab */}
                    <TabsContent value="display" className="space-y-4 mt-4">
                        {/* Show in Cell */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="flex items-center gap-1">
                                    {editedEvent.showInCell !== false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                    Show in Calendar Cell
                                </Label>
                                <p className="text-xs text-muted-foreground">Display this event in the day cell</p>
                            </div>
                            <Switch
                                checked={editedEvent.showInCell !== false}
                                onCheckedChange={(checked) => handleChange('showInCell', checked)}
                            />
                        </div>

                        {/* Cell Display Mode */}
                        {editedEvent.showInCell !== false && (
                            <div className="space-y-2">
                                <Label>Cell Display Mode</Label>
                                <Select
                                    value={editedEvent.cellDisplayMode || 'full'}
                                    onValueChange={(v) => handleChange('cellDisplayMode', v as CellDisplayMode)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="minimal">Minimal (dot only)</SelectItem>
                                        <SelectItem value="badge">Badge (icon + short)</SelectItem>
                                        <SelectItem value="full">Full (title + status)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <Separator />

                        {/* Pin to Timeline */}
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="flex items-center gap-1">
                                    {editedEvent.pinnedToTimeline ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                                    Pin to Timeline
                                </Label>
                                <p className="text-xs text-muted-foreground">Always show on the timeline bar</p>
                            </div>
                            <Switch
                                checked={editedEvent.pinnedToTimeline || false}
                                onCheckedChange={(checked) => handleChange('pinnedToTimeline', checked)}
                            />
                        </div>
                    </TabsContent>
                </Tabs>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t flex justify-between">
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
                        <Save className="h-4 w-4 mr-1" /> Save
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}

export default EventDetailPanel;
