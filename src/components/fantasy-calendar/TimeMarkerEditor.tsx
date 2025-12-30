/**
 * TimeMarkerEditor - Add and manage time markers (major historical events)
 */

import React, { useState } from 'react';
import { Plus, Trash2, Milestone, CalendarClock } from 'lucide-react';
import { TimeMarker, EraDefinition, CalendarDefinition } from '@/lib/fantasy-calendar/types';
import { formatYearWithEra } from '@/lib/fantasy-calendar/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

interface TimeMarkerEditorProps {
    markers: TimeMarker[];
    calendar: CalendarDefinition;
    onChange: (markers: TimeMarker[]) => void;
}

const IMPORTANCE_COLORS = {
    epoch: '#8b5cf6',
    major: '#3b82f6',
    minor: '#6b7280'
};

export function TimeMarkerEditor({ markers, calendar, onChange }: TimeMarkerEditorProps) {
    const [newMarkerName, setNewMarkerName] = useState('');
    const [newMarkerYear, setNewMarkerYear] = useState(1);
    const [newMarkerImportance, setNewMarkerImportance] = useState<'epoch' | 'major' | 'minor'>('major');

    const addMarker = () => {
        if (!newMarkerName.trim()) return;

        const newMarker: TimeMarker = {
            id: `marker_${Date.now()}`,
            calendarId: calendar.id,
            name: newMarkerName.trim(),
            year: newMarkerYear,
            importance: newMarkerImportance,
            color: IMPORTANCE_COLORS[newMarkerImportance]
        };

        onChange([...markers, newMarker].sort((a, b) => a.year - b.year));
        setNewMarkerName('');
    };

    const updateMarker = (id: string, updates: Partial<TimeMarker>) => {
        const updated = markers.map(m => m.id === id ? { ...m, ...updates } : m);
        onChange(updated.sort((a, b) => a.year - b.year));
    };

    const removeMarker = (id: string) => {
        onChange(markers.filter(m => m.id !== id));
    };

    // Sample markers for inspiration
    const loadSampleMarkers = () => {
        const samples: TimeMarker[] = [
            { id: 'sample_1', calendarId: calendar.id, name: 'World Creation', year: -10000, importance: 'epoch', color: IMPORTANCE_COLORS.epoch },
            { id: 'sample_2', calendarId: calendar.id, name: 'First Age Begins', year: -5000, importance: 'epoch', color: IMPORTANCE_COLORS.epoch },
            { id: 'sample_3', calendarId: calendar.id, name: 'The Great Cataclysm', year: -1000, importance: 'major', color: IMPORTANCE_COLORS.major },
            { id: 'sample_4', calendarId: calendar.id, name: 'Founding of the Empire', year: 1, importance: 'major', color: IMPORTANCE_COLORS.major },
        ];
        onChange(samples);
    };

    return (
        <Card className="border-amber-500/20">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Milestone className="h-4 w-4" />
                            Time Markers
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Major events on your timeline
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadSampleMarkers}>
                        Load Samples
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Add new marker form */}
                <div className="flex gap-2">
                    <Input
                        value={newMarkerName}
                        onChange={(e) => setNewMarkerName(e.target.value)}
                        placeholder="Event name..."
                        className="h-8 text-sm flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && addMarker()}
                    />
                    <Input
                        type="number"
                        value={newMarkerYear}
                        onChange={(e) => setNewMarkerYear(parseInt(e.target.value) || 0)}
                        className="h-8 text-sm w-20"
                        placeholder="Year"
                    />
                    <Select value={newMarkerImportance} onValueChange={(v: any) => setNewMarkerImportance(v)}>
                        <SelectTrigger className="h-8 w-24">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="epoch">Epoch</SelectItem>
                            <SelectItem value="major">Major</SelectItem>
                            <SelectItem value="minor">Minor</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button size="sm" className="h-8" onClick={addMarker} disabled={!newMarkerName.trim()}>
                        <Plus className="h-3 w-3" />
                    </Button>
                </div>

                {/* Marker list */}
                <ScrollArea className="h-40">
                    <div className="space-y-2 pr-4">
                        {markers.length === 0 ? (
                            <div className="text-center text-muted-foreground text-sm py-4">
                                No time markers yet. Add events like "The Great War" or "Founding of the City".
                            </div>
                        ) : (
                            markers.map(marker => (
                                <div
                                    key={marker.id}
                                    className="flex items-center gap-2 p-2 bg-muted/30 rounded border"
                                >
                                    <div
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: marker.color || IMPORTANCE_COLORS[marker.importance] }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <Input
                                            value={marker.name}
                                            onChange={(e) => updateMarker(marker.id, { name: e.target.value })}
                                            className="h-6 text-sm border-none bg-transparent p-0 focus-visible:ring-0"
                                        />
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className="text-xs shrink-0"
                                        style={{ borderColor: marker.color }}
                                    >
                                        {formatYearWithEra(calendar, marker.year)}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs capitalize shrink-0">
                                        {marker.importance}
                                    </Badge>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                        onClick={() => removeMarker(marker.id)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>

                {/* Summary */}
                {markers.length > 0 && (
                    <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{markers.filter(m => m.importance === 'epoch').length} epochs</span>
                        <span>•</span>
                        <span>{markers.filter(m => m.importance === 'major').length} major events</span>
                        <span>•</span>
                        <span>{markers.filter(m => m.importance === 'minor').length} minor events</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default TimeMarkerEditor;
