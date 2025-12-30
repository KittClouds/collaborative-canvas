/**
 * EventCreator - Rich event creation with expand/collapse UI
 * Clean, minimal design with type presets based on current scale
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown,
    ChevronUp,
    Plus,
    Calendar,
    Tag,
    Palette,
    Clock,
    Repeat,
    type LucideIcon
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCalendarContext } from '@/contexts/CalendarContext';
import { cn } from '@/lib/utils';
import {
    TimeScale,
    getEventTypesForScale,
    getEventTypeById,
    EventTypeDefinition,
    DEFAULT_EVENT_TYPE_ID,
} from '@/lib/fantasy-calendar/eventTypeRegistry';
import { EventImportance, EventCategory, CalendarEvent } from '@/lib/fantasy-calendar/types';
import { IMPORTANCE_COLORS } from '@/lib/fantasy-calendar/calendarEventSchema';

// Pending event type (form state)
type PendingEvent = Omit<CalendarEvent, 'id' | 'calendarId'> & { tempId: string };

interface EventCreatorProps {
    className?: string;
}

// Color presets
const COLOR_PRESETS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#8b5cf6', '#ec4899',
];

// Get Lucide icon by name
function getIcon(name: string): LucideIcon {
    const iconName = name.split('-').map(s =>
        s.charAt(0).toUpperCase() + s.slice(1)
    ).join('') as keyof typeof LucideIcons;
    return (LucideIcons[iconName] as LucideIcon) || LucideIcons.Calendar;
}

export function EventCreator({ className }: EventCreatorProps) {
    const {
        calendar,
        viewDate,
        currentMonth,
        daysInCurrentMonth,
        viewYearFormatted,
        addEvent,
    } = useCalendarContext();

    // State
    const [isExpanded, setIsExpanded] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedTypeId, setSelectedTypeId] = useState<string>(DEFAULT_EVENT_TYPE_ID);
    const [day, setDay] = useState('1');
    const [color, setColor] = useState<string | undefined>(undefined);
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [importance, setImportance] = useState<EventImportance>('moderate');

    // Queue for multiple events
    const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);

    // Determine current scale from context (graceful fallback to 'month')
    const currentScale: TimeScale = useMemo(() => {
        // Could be enhanced to read from a context-provided scale
        return 'month'; // Default fallback
    }, []);

    // Get event types for current scale
    const eventTypes = useMemo(() =>
        getEventTypesForScale(currentScale),
        [currentScale]
    );

    const selectedType = getEventTypeById(selectedTypeId);

    // Handlers
    const createEventObject = (): PendingEvent | null => {
        if (!title.trim()) return null;

        const eventType = getEventTypeById(selectedTypeId);

        return {
            tempId: Math.random().toString(36),
            date: {
                year: viewDate.year,
                monthIndex: viewDate.monthIndex,
                dayIndex: parseInt(day) - 1,
            },
            title: title.trim(),
            description: description.trim() || undefined,
            importance: importance,
            category: eventType?.category || 'general',
            color: color || eventType?.color,
            tags: tags.length > 0 ? tags : undefined,
            eventTypeId: selectedTypeId !== DEFAULT_EVENT_TYPE_ID ? selectedTypeId : undefined
        };
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setSelectedTypeId(DEFAULT_EVENT_TYPE_ID);
        // Keep day and color/importance for convenience if adding multiple related events?
        // Let's reset for now to be safe, maybe keep day.
        // setDay('1'); // Keep the day!
        setColor(undefined);
        setTags([]);
        // setImportance('moderate'); // Keep importance?
    };

    const handleQueueEvent = () => {
        const evt = createEventObject();
        if (evt) {
            setPendingEvents([...pendingEvents, evt]);
            resetForm();
            // Focus title input? (need ref)
        }
    };

    const handleAddAllEvents = () => {
        const currentEvt = createEventObject();
        const allEvents = [...pendingEvents];
        if (currentEvt) {
            allEvents.push(currentEvt);
        }

        if (allEvents.length === 0) return;

        allEvents.forEach(evt => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { tempId, ...eventData } = evt;
            addEvent(eventData);
        });

        // Reset everything
        setPendingEvents([]);
        resetForm();
        setDay('1');
        setIsExpanded(false);
    };

    const handleSelectType = (type: EventTypeDefinition) => {
        setSelectedTypeId(type.id);
        setImportance(type.importance);
        if (!color) {
            setColor(type.color);
        }
    };

    const handleAddTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            setTags([...tags, newTag.trim()]);
            setNewTag('');
        }
    };

    const handleRemoveTag = (tag: string) => {
        setTags(tags.filter(t => t !== tag));
    };

    return (
        <div className={cn("space-y-3", className)}>
            {/* Quick Add Row */}
            <div className="flex gap-2">
                <Input
                    placeholder="What happened?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="flex-1 h-9"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isExpanded) {
                            handleAddAllEvents();
                        }
                    }}
                />
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                    ) : (
                        <ChevronDown className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* Expandable Details */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-4 pt-2">
                            {/* Event Type Picker */}
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Event Type</Label>
                                <ScrollArea className="h-20">
                                    <div className="flex flex-wrap gap-1">
                                        {eventTypes.map((type) => {
                                            const Icon = getIcon(type.icon);
                                            const isSelected = type.id === selectedTypeId;
                                            return (
                                                <button
                                                    key={type.id}
                                                    onClick={() => handleSelectType(type)}
                                                    className={cn(
                                                        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all",
                                                        isSelected
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-muted/50 hover:bg-muted"
                                                    )}
                                                    style={{
                                                        borderLeft: `3px solid ${type.color}`,
                                                    }}
                                                >
                                                    <Icon className="h-3 w-3" />
                                                    {type.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* Date Row */}
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground">Day</Label>
                                    <Select value={day} onValueChange={setDay}>
                                        <SelectTrigger className="h-8 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: daysInCurrentMonth }, (_, i) => (
                                                <SelectItem key={i} value={String(i + 1)}>
                                                    Day {i + 1}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-[2]">
                                    <Label className="text-xs text-muted-foreground">Month & Year</Label>
                                    <div className="h-8 px-2 bg-muted/50 rounded-md flex items-center text-sm text-muted-foreground">
                                        {currentMonth.name}, {viewYearFormatted}
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <Label className="text-xs text-muted-foreground">Description</Label>
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="What happened..."
                                    rows={2}
                                    className="text-sm resize-none"
                                />
                            </div>

                            {/* Color & Importance Row */}
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground">Color</Label>
                                    <div className="flex gap-1 mt-1">
                                        {COLOR_PRESETS.map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => setColor(color === c ? undefined : c)}
                                                className={cn(
                                                    "w-5 h-5 rounded-full transition-all",
                                                    color === c ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-110"
                                                )}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground">Importance</Label>
                                    <Select value={importance} onValueChange={(v) => setImportance(v as EventImportance)}>
                                        <SelectTrigger className="h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(['trivial', 'minor', 'moderate', 'major', 'critical'] as const).map((level) => (
                                                <SelectItem key={level} value={level}>
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-2 h-2 rounded-full"
                                                            style={{ backgroundColor: IMPORTANCE_COLORS[level] }}
                                                        />
                                                        <span className="capitalize">{level}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Tags */}
                            <Collapsible>
                                <CollapsibleTrigger asChild>
                                    <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                                        <Tag className="h-3 w-3" />
                                        Tags {tags.length > 0 && `(${tags.length})`}
                                        <ChevronDown className="h-3 w-3" />
                                    </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-2">
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        {tags.map((tag) => (
                                            <Badge key={tag} variant="secondary" className="text-xs gap-1">
                                                {tag}
                                                <button onClick={() => handleRemoveTag(tag)} className="hover:text-destructive">×</button>
                                            </Badge>
                                        ))}
                                    </div>
                                    <div className="flex gap-1">
                                        <Input
                                            value={newTag}
                                            onChange={(e) => setNewTag(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                            placeholder="Add tag..."
                                            className="h-7 text-xs flex-1"
                                        />
                                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleAddTag}>
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pending Events List */}
            {pendingEvents.length > 0 && (
                <div className="space-y-1 bg-muted/30 p-2 rounded-md border text-xs">
                    <Label className="text-xs text-muted-foreground">Pending Events ({pendingEvents.length})</Label>
                    {pendingEvents.map(evt => (
                        <div key={evt.tempId} className="flex justify-between items-center bg-background p-1.5 rounded border">
                            <span className="truncate flex-1">{evt.title}</span>
                            <span className="text-muted-foreground ml-2">Day {evt.date.dayIndex + 1}</span>
                            <button
                                onClick={() => setPendingEvents(pendingEvents.filter(p => p.tempId !== evt.tempId))}
                                className="ml-2 text-destructive hover:text-destructive/80"
                            >
                                <Plus className="h-3 w-3 rotate-45" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
                {isExpanded && (
                    <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 h-8"
                        onClick={handleQueueEvent}
                        disabled={!title.trim()}
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Another
                    </Button>
                )}
                <Button
                    size="sm"
                    className="flex-[2] h-8"
                    onClick={handleAddAllEvents}
                    disabled={!title.trim() && pendingEvents.length === 0}
                >
                    <Plus className="h-3 w-3 mr-1" />
                    {pendingEvents.length > 0
                        ? (title.trim() ? `Add ${pendingEvents.length + 1} Events` : `Add ${pendingEvents.length} Pending Events`)
                        : (isExpanded ? 'Add Event' : `Add to ${currentMonth.name}`)}
                </Button>
            </div>
        </div>
    );
}

export default EventCreator;
