/**
 * EventEditDialog - Dialog for editing calendar events
 * Uses Radix Dialog with form validation
 */

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
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
import { CalendarEvent } from '@/lib/fantasy-calendar/types';
import {
    EventImportance,
    EventCategory,
    IMPORTANCE_COLORS,
    CATEGORY_ICONS,
    eventImportanceSchema,
    eventCategorySchema,
} from '@/lib/fantasy-calendar/calendarEventSchema';
import { useCalendarContext } from '@/contexts/CalendarContext';
import { X } from 'lucide-react';

interface EventEditDialogProps {
    event: CalendarEvent | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Pre-defined colors for quick selection
const COLOR_PRESETS = [
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#6b7280', // Gray
];

export function EventEditDialog({ event, open, onOpenChange }: EventEditDialogProps) {
    const { updateEvent, calendar } = useCalendarContext();

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [importance, setImportance] = useState<EventImportance>('moderate');
    const [category, setCategory] = useState<EventCategory>('general');
    const [color, setColor] = useState<string | undefined>(undefined);
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');

    // Reset form when event changes
    useEffect(() => {
        if (event) {
            setTitle(event.title || '');
            setDescription(event.description || '');
            setImportance(event.importance || 'moderate');
            setCategory(event.category || 'general');
            setColor(event.color);
            setTags(event.tags || []);
        }
    }, [event]);

    const handleSave = () => {
        if (!event) return;

        updateEvent(event.id, {
            title,
            description: description || undefined,
            importance,
            category,
            color,
            tags,
        });

        onOpenChange(false);
    };

    const handleAddTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            setTags([...tags, newTag.trim()]);
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    if (!event) return null;

    const monthName = calendar.months[event.date.monthIndex]?.name || `Month ${event.date.monthIndex + 1}`;
    const dateDisplay = `${monthName} ${event.date.dayIndex + 1}, Year ${event.date.year}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Event</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Title */}
                    <div className="grid gap-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Event title"
                            maxLength={200}
                        />
                    </div>

                    {/* Date (read-only) */}
                    <div className="grid gap-2">
                        <Label>Date</Label>
                        <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                            {dateDisplay}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Event description..."
                            rows={3}
                            maxLength={5000}
                        />
                    </div>

                    {/* Importance & Category */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Importance</Label>
                            <Select value={importance} onValueChange={(v) => setImportance(v as EventImportance)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {eventImportanceSchema.options.map((level) => (
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

                        <div className="grid gap-2">
                            <Label>Category</Label>
                            <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {eventCategorySchema.options.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            <span className="capitalize">{cat}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Color */}
                    <div className="grid gap-2">
                        <Label>Color (optional override)</Label>
                        <div className="flex items-center gap-2">
                            {COLOR_PRESETS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(color === c ? undefined : c)}
                                    className={`w-6 h-6 rounded-full transition-all ${color === c
                                        ? 'ring-2 ring-offset-2 ring-primary scale-110'
                                        : 'hover:scale-110'
                                        }`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                            {color && (
                                <button
                                    type="button"
                                    onClick={() => setColor(undefined)}
                                    className="text-xs text-muted-foreground hover:text-foreground ml-2"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="grid gap-2">
                        <Label>Tags</Label>
                        <div className="flex flex-wrap gap-1 mb-2">
                            {tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="gap-1">
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTag(tag)}
                                        className="ml-1 hover:text-destructive"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Add tag..."
                                maxLength={50}
                                className="flex-1"
                            />
                            <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>
                                Add
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!title.trim()}>
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default EventEditDialog;
