/**
 * EraEditor - Configure calendar eras with BCE/CE style time handling
 */

import React from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { EraDefinition } from '@/lib/fantasy-calendar/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface EraEditorProps {
    eras: EraDefinition[];
    defaultEraId: string;
    hasYearZero: boolean;
    onChange: (eras: EraDefinition[], defaultEraId: string, hasYearZero: boolean) => void;
}

const DEFAULT_ERA_COLORS = [
    '#8b5cf6', // Purple
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
];

export function EraEditor({ eras, defaultEraId, hasYearZero, onChange }: EraEditorProps) {
    const addEra = () => {
        const newEra: EraDefinition = {
            id: `era_${Date.now()}`,
            name: `Era ${eras.length + 1}`,
            abbreviation: `E${eras.length + 1}`,
            startYear: eras.length > 0 ? (eras[eras.length - 1].endYear || 0) + 1 : 1,
            direction: 'ascending',
            color: DEFAULT_ERA_COLORS[eras.length % DEFAULT_ERA_COLORS.length]
        };
        onChange([...eras, newEra], defaultEraId, hasYearZero);
    };

    const updateEra = (index: number, updates: Partial<EraDefinition>) => {
        const updated = eras.map((era, i) => i === index ? { ...era, ...updates } : era);
        onChange(updated, defaultEraId, hasYearZero);
    };

    const removeEra = (index: number) => {
        if (eras.length <= 1) return;
        const newEras = eras.filter((_, i) => i !== index);
        const newDefaultId = eras[index].id === defaultEraId ? newEras[0].id : defaultEraId;
        onChange(newEras, newDefaultId, hasYearZero);
    };

    const setAsDefault = (eraId: string) => {
        onChange(eras, eraId, hasYearZero);
    };

    const toggleYearZero = () => {
        onChange(eras, defaultEraId, !hasYearZero);
    };

    // Load BCE/CE preset
    const loadBCECEPreset = () => {
        const bce: EraDefinition = {
            id: 'era_bce',
            name: 'Before Common Era',
            abbreviation: 'BCE',
            startYear: -10000,
            endYear: -1,
            direction: 'descending',
            isNegative: true,
            color: '#8b5cf6'
        };
        const ce: EraDefinition = {
            id: 'era_ce',
            name: 'Common Era',
            abbreviation: 'CE',
            startYear: 1,
            direction: 'ascending',
            color: '#3b82f6'
        };
        onChange([bce, ce], 'era_ce', false);
    };

    return (
        <Card className="border-violet-500/20">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Eras & Time Direction</CardTitle>
                    <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadBCECEPreset}>
                            BCE/CE
                        </Button>
                        <Button variant="outline" size="sm" className="h-7" onClick={addEra}>
                            <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Year Zero Toggle */}
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                    <div className="space-y-0.5">
                        <Label className="text-sm">Has Year Zero?</Label>
                        <p className="text-xs text-muted-foreground">
                            {hasYearZero
                                ? 'Year 0 exists between -1 and 1'
                                : 'Jumps from -1 BCE to 1 CE (no year 0)'
                            }
                        </p>
                    </div>
                    <Switch checked={hasYearZero} onCheckedChange={toggleYearZero} />
                </div>

                {/* Era List */}
                <ScrollArea className="h-48">
                    <div className="space-y-3 pr-4">
                        {eras.map((era, index) => (
                            <div
                                key={era.id}
                                className="p-3 border rounded-lg space-y-3"
                                style={{ borderColor: era.color || 'hsl(var(--border))' }}
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: era.color }}
                                    />
                                    <Input
                                        value={era.name}
                                        onChange={(e) => updateEra(index, { name: e.target.value })}
                                        placeholder="Era Name"
                                        className="h-7 text-sm"
                                    />
                                    <Input
                                        value={era.abbreviation}
                                        onChange={(e) => updateEra(index, { abbreviation: e.target.value })}
                                        placeholder="Abbr"
                                        className="h-7 w-16 text-sm"
                                        maxLength={4}
                                    />
                                    {era.id === defaultEraId ? (
                                        <Badge variant="secondary" className="text-xs shrink-0">Default</Badge>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={() => setAsDefault(era.id)}
                                        >
                                            Set Default
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                                        onClick={() => removeEra(index)}
                                        disabled={eras.length <= 1}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Start Year</Label>
                                        <Input
                                            type="number"
                                            value={era.startYear}
                                            onChange={(e) => updateEra(index, { startYear: parseInt(e.target.value) || 0 })}
                                            className="h-7 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">End Year</Label>
                                        <Input
                                            type="number"
                                            value={era.endYear ?? ''}
                                            onChange={(e) => updateEra(index, {
                                                endYear: e.target.value ? parseInt(e.target.value) : undefined
                                            })}
                                            placeholder="Ongoing"
                                            className="h-7 text-sm"
                                        />
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <Switch
                                                checked={era.isNegative || false}
                                                onCheckedChange={(checked) => updateEra(index, { isNegative: checked })}
                                            />
                                            <Label className="text-xs">Negative</Label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

export default EraEditor;
