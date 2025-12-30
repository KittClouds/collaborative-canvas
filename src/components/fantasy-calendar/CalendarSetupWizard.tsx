import React, { useState, useEffect } from 'react';
import {
    Orbit,
    CalendarDays,
    Save,
    Wand2,
    Plus,
    Trash2,
    Sparkles,
    RotateCcw,
    Clock,
    Loader2
} from 'lucide-react';
import {
    getStarDefaults,
    generateOrbitalCalendar
} from '@/lib/fantasy-calendar/orbital';
import { OrbitalMechanics, StarType, EraDefinition, EpochDefinition, TimeMarker } from '@/lib/fantasy-calendar/types';
import { CalendarConfig } from '@/hooks/useFantasyCalendar';
import { generateUUID } from '@/lib/fantasy-calendar/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface CalendarSetupWizardProps {
    onComplete: (config: CalendarConfig) => Promise<void> | void;
    isGenerating?: boolean;
}

// Generate default day names
function generateDefaultDayNames(count: number): string[] {
    return Array.from({ length: count }, (_, i) => `Day ${i + 1}`);
}

// Generate default month names  
function generateDefaultMonthNames(count: number): string[] {
    return Array.from({ length: count }, (_, i) => `Month ${i + 1}`);
}

export function CalendarSetupWizard({ onComplete, isGenerating = false }: CalendarSetupWizardProps) {
    const [mode, setMode] = useState<'simulation' | 'manual'>('simulation');

    // Common fields
    const [calendarName, setCalendarName] = useState('');
    const [startingYear, setStartingYear] = useState(1);
    const [eraName, setEraName] = useState('');
    const [eraAbbreviation, setEraAbbreviation] = useState('');

    // Orbital Simulation State
    const [orbital, setOrbital] = useState<OrbitalMechanics>({
        starType: 'yellow_dwarf',
        starMass: 1.0,
        orbitalRadius: 1.0,
        axialTilt: 23.5,
        rotationPeriod: 24,
        orbitalPeriod: 365.25
    });

    // Computed orbital values
    const computed = generateOrbitalCalendar(orbital);

    // Dynamic weekday state - syncs with orbital calculations
    const [daysPerWeek, setDaysPerWeek] = useState(7);
    const [weekdayNames, setWeekdayNames] = useState<string[]>(generateDefaultDayNames(7));

    // Dynamic month state
    const [monthNames, setMonthNames] = useState<string[]>(generateDefaultMonthNames(12));

    // Era/Timeline state
    const [eras, setEras] = useState<EraDefinition[]>([
        { id: 'era_default', name: 'Common Era', abbreviation: 'CE', startYear: 1, direction: 'ascending' }
    ]);
    const [defaultEraId, setDefaultEraId] = useState('era_default');
    const [hasYearZero, setHasYearZero] = useState(false);
    const [timeMarkers, setTimeMarkers] = useState<TimeMarker[]>([]);

    // Sync weekday count when orbital params change (for simulation mode)
    useEffect(() => {
        if (mode === 'simulation') {
            const suggested = computed.suggestedDaysPerWeek;
            if (suggested !== daysPerWeek) {
                setDaysPerWeek(suggested);
                setWeekdayNames(generateDefaultDayNames(suggested));
            }
        }
    }, [computed.suggestedDaysPerWeek, mode]);

    const updateStar = (type: StarType) => {
        const defaults = getStarDefaults(type);
        setOrbital(prev => ({ ...prev, starType: type, ...defaults }));
    };

    // Weekday management
    const updateWeekdayName = (index: number, name: string) => {
        setWeekdayNames(prev => {
            const updated = [...prev];
            updated[index] = name;
            return updated;
        });
    };

    const handleDaysPerWeekChange = (value: number) => {
        const newCount = Math.max(4, Math.min(14, value));
        setDaysPerWeek(newCount);
        // Resize weekday names array
        if (newCount > weekdayNames.length) {
            setWeekdayNames([...weekdayNames, ...generateDefaultDayNames(newCount - weekdayNames.length).map((_, i) => `Day ${weekdayNames.length + i + 1}`)]);
        } else {
            setWeekdayNames(weekdayNames.slice(0, newCount));
        }
    };

    // Month management
    const updateMonthName = (index: number, name: string) => {
        setMonthNames(prev => {
            const updated = [...prev];
            updated[index] = name;
            return updated;
        });
    };

    const addMonth = () => {
        setMonthNames(prev => [...prev, `Month ${prev.length + 1}`]);
    };

    const removeMonth = (index: number) => {
        if (monthNames.length <= 1) return;
        setMonthNames(prev => prev.filter((_, i) => i !== index));
    };

    const handleComplete = (useOrbital: boolean) => {
        const config: CalendarConfig = {
            name: calendarName || 'New World Calendar',
            startingYear: startingYear || 1,
            eraName: eras[0]?.name || 'Common Era',
            eraAbbreviation: eras[0]?.abbreviation || 'CE',
            monthNames: monthNames.filter(m => m.trim() !== ''),
            weekdayNames: weekdayNames.filter(w => w.trim() !== ''),
            orbitalMechanics: useOrbital ? orbital : undefined,
            eras: eras,
            timeMarkers: timeMarkers,
            hasYearZero: hasYearZero
        };
        onComplete(config);
    };

    // Preset loader
    const loadPreset = (preset: 'earth' | 'taldorei' | 'custom') => {
        if (preset === 'custom') {
            // Clean slate
            setCalendarName('');
            setStartingYear(1);
            setEraName('');
            setEraAbbreviation('');
            const suggestedDays = computed.suggestedDaysPerWeek;
            setDaysPerWeek(suggestedDays);
            setWeekdayNames(generateDefaultDayNames(suggestedDays));
            setMonthNames(generateDefaultMonthNames(12));
        } else if (preset === 'earth') {
            setCalendarName('Earth Calendar');
            setStartingYear(1);
            setDaysPerWeek(7);
            setWeekdayNames(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
            setMonthNames(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
            setEraName('Common Era');
            setEraAbbreviation('CE');
        } else if (preset === 'taldorei') {
            setCalendarName("Tal'Dorei Calendar");
            setStartingYear(835);
            setDaysPerWeek(7);
            setWeekdayNames(['Miresen', 'Grissen', 'Whelsen', 'Conthsen', 'Folsen', 'Yulisen', "Da'leysen"]);
            setMonthNames(['Horisal', 'Misuthar', 'Dualahei', 'Thunsheer', 'Unndilar', 'Brussendar', 'Sydenstar', 'Fessuran', "Quen'pillar", 'Cuersaar', 'Duscar']);
            setEraName('Post-Divergence');
            setEraAbbreviation('PD');
        }
    };

    // Common configuration card
    const CommonConfigCard = () => (
        <Card className="border-emerald-500/20">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Calendar Identity</CardTitle>
                    <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => loadPreset('custom')}>
                            <RotateCcw className="h-3 w-3 mr-1" /> Custom
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => loadPreset('earth')}>
                            <Sparkles className="h-3 w-3 mr-1" /> Earth
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => loadPreset('taldorei')}>
                            <Sparkles className="h-3 w-3 mr-1" /> Tal'Dorei
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Calendar Name</Label>
                        <Input
                            placeholder="My World Calendar"
                            value={calendarName}
                            onChange={(e) => setCalendarName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Starting Year</Label>
                        <Input
                            type="number"
                            placeholder="1"
                            value={startingYear}
                            onChange={(e) => setStartingYear(parseInt(e.target.value) || 1)}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Era Name</Label>
                        <Input
                            placeholder="Common Era"
                            value={eraName}
                            onChange={(e) => setEraName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Era Abbreviation</Label>
                        <Input
                            placeholder="CE"
                            value={eraAbbreviation}
                            onChange={(e) => setEraAbbreviation(e.target.value)}
                            maxLength={4}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    // Weekday editor card
    const WeekdayEditorCard = () => (
        <Card className="border-orange-500/20">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base">Weekday Names</CardTitle>
                        <div className="text-xs text-muted-foreground">
                            {mode === 'simulation' && (
                                <Badge variant="secondary" className="mt-1">
                                    Suggested: {computed.suggestedDaysPerWeek} days/week
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label>Days per Week</Label>
                        <span className="text-sm font-mono">{daysPerWeek}</span>
                    </div>
                    <Slider
                        value={[daysPerWeek]}
                        min={4}
                        max={14}
                        step={1}
                        onValueChange={([v]) => handleDaysPerWeekChange(v)}
                    />
                </div>
                <ScrollArea className="h-32 pr-4">
                    <div className="space-y-1">
                        {weekdayNames.map((name, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <span className="w-5 text-xs text-muted-foreground">{index + 1}.</span>
                                <Input
                                    value={name}
                                    onChange={(e) => updateWeekdayName(index, e.target.value)}
                                    placeholder={`Day ${index + 1}`}
                                    className="h-7 text-sm"
                                />
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );

    // Month editor card
    const MonthEditorCard = () => (
        <Card className="border-blue-500/20">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Month Names</CardTitle>
                    <Button variant="outline" size="sm" onClick={addMonth} className="h-7">
                        <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-40 pr-4">
                    <div className="space-y-1">
                        {monthNames.map((name, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <span className="w-5 text-xs text-muted-foreground">{index + 1}.</span>
                                <Input
                                    value={name}
                                    onChange={(e) => updateMonthName(index, e.target.value)}
                                    placeholder={`Month ${index + 1}`}
                                    className="h-7 text-sm"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeMonth(index)}
                                    disabled={monthNames.length <= 1}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                    World Genesis
                </h1>
                <p className="text-muted-foreground">
                    Design the celestial mechanics of your world, or just pick the numbers.
                </p>
            </div>

            <Tabs value={mode} onValueChange={(v: any) => setMode(v)}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="simulation" className="gap-2">
                        <Orbit className="h-4 w-4" />
                        Orbital Simulation
                    </TabsTrigger>
                    <TabsTrigger value="manual" className="gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Manual Configuration
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="simulation" className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    {/* Row 1: Identity + Weekdays */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CommonConfigCard />
                        <WeekdayEditorCard />
                    </div>

                    {/* Row 2: Months + Orbital Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <MonthEditorCard />

                        <Card className="border-purple-500/20 shadow-lg shadow-purple-900/10">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Wand2 className="h-5 w-5 text-purple-400" />
                                    System Parameters
                                </CardTitle>
                                <CardDescription>
                                    Orbital mechanics drive calendar structure
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Star Type</Label>
                                    <Select
                                        value={orbital.starType}
                                        onValueChange={(v: StarType) => updateStar(v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="red_dwarf">Red Dwarf (Small, Cool)</SelectItem>
                                            <SelectItem value="yellow_dwarf">Yellow Dwarf (Earth-like)</SelectItem>
                                            <SelectItem value="blue_giant">Blue Giant (Massive, Hot)</SelectItem>
                                            <SelectItem value="binary">Binary System (Two Stars)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label>Orbital Distance</Label>
                                        <span className="text-xs font-mono text-muted-foreground">{orbital.orbitalRadius.toFixed(2)} AU</span>
                                    </div>
                                    <Slider
                                        value={[orbital.orbitalRadius]}
                                        min={0.1}
                                        max={50}
                                        step={0.1}
                                        onValueChange={([v]) => setOrbital(p => ({ ...p, orbitalRadius: v }))}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label>Day Length</Label>
                                        <span className="text-xs font-mono text-muted-foreground">{orbital.rotationPeriod.toFixed(1)} hrs</span>
                                    </div>
                                    <Slider
                                        value={[orbital.rotationPeriod]}
                                        min={4}
                                        max={72}
                                        step={0.5}
                                        onValueChange={([v]) => setOrbital(p => ({ ...p, rotationPeriod: v }))}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Row 3: Timeline Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Era Configuration */}
                        <Card className="border-violet-500/20">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Eras & Time Direction
                                    </CardTitle>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => {
                                            setEras([
                                                { id: 'era_bce', name: 'Before Common Era', abbreviation: 'BCE', startYear: -10000, endYear: -1, direction: 'descending', isNegative: true },
                                                { id: 'era_ce', name: 'Common Era', abbreviation: 'CE', startYear: 1, direction: 'ascending' }
                                            ]);
                                            setDefaultEraId('era_ce');
                                            setHasYearZero(false);
                                        }}
                                    >
                                        BCE/CE
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm">Has Year Zero?</Label>
                                        <p className="text-xs text-muted-foreground">
                                            {hasYearZero ? 'Year 0 exists' : 'Jumps from -1 to 1'}
                                        </p>
                                    </div>
                                    <Switch checked={hasYearZero} onCheckedChange={setHasYearZero} />
                                </div>
                                <ScrollArea className="h-32">
                                    <div className="space-y-2 pr-4">
                                        {eras.map((era, index) => (
                                            <div key={era.id} className="flex items-center gap-2 p-2 border rounded">
                                                <Input
                                                    value={era.name}
                                                    onChange={(e) => {
                                                        const updated = [...eras];
                                                        updated[index] = { ...era, name: e.target.value };
                                                        setEras(updated);
                                                    }}
                                                    placeholder="Era Name"
                                                    className="h-7 text-sm flex-1"
                                                />
                                                <Input
                                                    value={era.abbreviation}
                                                    onChange={(e) => {
                                                        const updated = [...eras];
                                                        updated[index] = { ...era, abbreviation: e.target.value };
                                                        setEras(updated);
                                                    }}
                                                    placeholder="Abbr"
                                                    className="h-7 w-16 text-sm"
                                                    maxLength={4}
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => {
                                                        if (eras.length > 1) {
                                                            setEras(eras.filter((_, i) => i !== index));
                                                        }
                                                    }}
                                                    disabled={eras.length <= 1}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-7"
                                    onClick={() => {
                                        setEras([...eras, {
                                            id: generateUUID(),
                                            name: `Era ${eras.length + 1}`,
                                            abbreviation: `E${eras.length + 1}`,
                                            startYear: 1,
                                            direction: 'ascending'
                                        }]);
                                    }}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Add Era
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Time Markers */}
                        <Card className="border-amber-500/20">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Time Markers (Optional)</CardTitle>
                                <CardDescription className="text-xs">
                                    Major events like "Fall of the Empire"
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <ScrollArea className="h-32">
                                    <div className="space-y-2 pr-4">
                                        {timeMarkers.length === 0 ? (
                                            <div className="text-center text-muted-foreground text-xs py-4">
                                                No markers yet. Add events after creation.
                                            </div>
                                        ) : (
                                            timeMarkers.map((marker, index) => (
                                                <div key={marker.id} className="flex items-center gap-2 p-2 border rounded">
                                                    <Input
                                                        value={marker.name}
                                                        onChange={(e) => {
                                                            const updated = [...timeMarkers];
                                                            updated[index] = { ...marker, name: e.target.value };
                                                            setTimeMarkers(updated);
                                                        }}
                                                        className="h-7 text-sm flex-1"
                                                    />
                                                    <Badge variant="outline" className="text-xs">
                                                        {marker.year}
                                                    </Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => setTimeMarkers(timeMarkers.filter((_, i) => i !== index))}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Event name..."
                                        id="new-marker-name"
                                        className="h-7 text-sm"
                                    />
                                    <Input
                                        type="number"
                                        placeholder="Year"
                                        id="new-marker-year"
                                        className="h-7 text-sm w-20"
                                        defaultValue={startingYear}
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7"
                                        onClick={() => {
                                            const nameInput = document.getElementById('new-marker-name') as HTMLInputElement;
                                            const yearInput = document.getElementById('new-marker-year') as HTMLInputElement;
                                            if (nameInput?.value) {
                                                setTimeMarkers([...timeMarkers, {
                                                    id: generateUUID(),
                                                    calendarId: '',
                                                    name: nameInput.value,
                                                    year: parseInt(yearInput?.value) || startingYear,
                                                    importance: 'major'
                                                }]);
                                                nameInput.value = '';
                                            }
                                        }}
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Results + Generate Button */}
                    <Card className="bg-slate-950 border-slate-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="grid grid-cols-3 gap-4 flex-1">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-400">{computed.daysPerYear}</div>
                                        <div className="text-xs text-slate-400">Days/Year</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-emerald-400">{daysPerWeek}</div>
                                        <div className="text-xs text-slate-400">Days/Week</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-purple-400">{monthNames.length}</div>
                                        <div className="text-xs text-slate-400">Months</div>
                                    </div>
                                </div>
                            </div>
                            <Button
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                                onClick={() => handleComplete(true)}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Constructing World Timeline...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Generate Calendar System
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="manual" className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CommonConfigCard />
                        <WeekdayEditorCard />
                    </div>
                    <MonthEditorCard />

                    {/* Era Configuration for Manual Mode */}
                    <Card className="border-violet-500/20">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Clock className="h-4 w-4" /> Eras & Time Direction
                                </CardTitle>
                                <div className="flex gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => {
                                            setEras([
                                                { id: 'era_bce', name: 'Before Common Era', abbreviation: 'BCE', startYear: -10000, endYear: -1, direction: 'descending', isNegative: true },
                                                { id: 'era_ce', name: 'Common Era', abbreviation: 'CE', startYear: 1, direction: 'ascending' }
                                            ]);
                                            setHasYearZero(false);
                                        }}
                                    >
                                        BCE/CE
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                <Label className="text-sm">Year Zero?</Label>
                                <Switch checked={hasYearZero} onCheckedChange={setHasYearZero} />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {eras.map((era, index) => (
                                    <div key={era.id} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm">
                                        <Input
                                            value={era.abbreviation}
                                            onChange={(e) => {
                                                const updated = [...eras];
                                                updated[index] = { ...era, abbreviation: e.target.value };
                                                setEras(updated);
                                            }}
                                            className="h-6 w-12 text-xs border-none bg-transparent p-0"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5"
                                            onClick={() => eras.length > 1 && setEras(eras.filter((_, i) => i !== index))}
                                            disabled={eras.length <= 1}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => setEras([...eras, { id: generateUUID(), name: 'New Era', abbreviation: 'NE', startYear: 1, direction: 'ascending' }])}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Era
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <Button
                                className="w-full"
                                onClick={() => handleComplete(false)}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Constructing World Timeline...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Create Calendar
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
