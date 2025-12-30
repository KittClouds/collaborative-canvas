
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarProvider, useCalendarContext, CalendarConfig } from '@/contexts/CalendarContext';
import { FantasyDate } from '@/lib/fantasy-calendar/types';
import { CalendarSetupWizard } from '@/components/fantasy-calendar/CalendarSetupWizard';
import { FantasyCalendarGrid } from '@/components/fantasy-calendar/FantasyCalendarGrid';
import { CalendarSidebar } from '@/components/fantasy-calendar/CalendarSidebar';
import { DualTimeline, TimeScale } from '@/components/fantasy-calendar/DualTimeline';
import { NarrativeEventEditor } from '@/components/fantasy-calendar/NarrativeEventEditor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, PlusCircle, CalendarClock, Clock, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';

// Inner component that consumes the context
function CalendarPageContent() {
    const navigate = useNavigate();
    const {
        calendar,
        viewDate,
        viewYearFormatted,
        events,
        isSetupMode,
        setIsSetupMode,
        navigateMonth,
        navigateYear,
        goToYear,
        goToDate,
        selectDay,
        createCalendar,
        setHighlightedEventId,
        getEventsForDay,
        setEditorScope,
        isGenerating
    } = useCalendarContext();

    const [showTimeline, setShowTimeline] = React.useState(true);
    const [scale, setScale] = React.useState<TimeScale>('decade');

    const handleBackToEditor = useCallback(() => {
        setTimeout(() => navigate('/'), 50);
    }, [navigate]);

    const handleWizardComplete = useCallback(async (config: CalendarConfig) => {
        await createCalendar(config);
        setIsSetupMode(false);
        toast.success(`Calendar "${config.name}" created!`, {
            description: `Starting year ${config.startingYear} ${config.eraAbbreviation || 'CE'}`
        });
    }, [createCalendar, setIsSetupMode]);

    // Calendar Grid Handlers
    const handleDayClick = (date: FantasyDate) => {
        // Select this day to highlight it
        selectDay(date.dayIndex);

        // Auto-scope editor to 'day' view
        setEditorScope('day');

        // If there are events on this day, highlight the first one to scroll timeline
        const dayEvents = getEventsForDay(date);
        if (dayEvents.length > 0) {
            setHighlightedEventId(dayEvents[0].id);
        }

        // Smooth scroll to the editor
        setTimeout(() => {
            document.getElementById('narrative-editor-container')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 50);
    };

    const handleEventClick = (id: string) => {
        setHighlightedEventId(id);
        // Also scroll to editor to see details
        setTimeout(() => {
            document.getElementById('narrative-editor-container')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 50);
    };

    const zoomIn = () => {
        if (scale === 'century') setScale('decade');
        else if (scale === 'decade') setScale('year');
        else if (scale === 'year') setScale('month');
    };

    const zoomOut = () => {
        if (scale === 'month') setScale('year');
        else if (scale === 'year') setScale('decade');
        else if (scale === 'decade') setScale('century');
    };

    if (isSetupMode) {
        return (
            <div className="min-h-screen bg-background">
                <div className="p-4">
                    <Button variant="outline" onClick={() => setIsSetupMode(false)}>Cancel</Button>
                </div>
                <CalendarSetupWizard onComplete={handleWizardComplete} isGenerating={isGenerating} />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Sidebar */}
            <CalendarSidebar onBackToEditor={handleBackToEditor} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 h-full">
                {/* Unified Top Header Bar */}
                <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur z-30 shrink-0 gap-4">

                    <div className="flex items-center gap-4 overflow-hidden">
                        {/* Back Button & App Title */}
                        <div className="flex items-center gap-2 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBackToEditor} title="Back to Editor">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center gap-2 text-sm font-medium hidden md:flex">
                                <CalendarClock className="h-4 w-4 text-primary" />
                                <span className="hidden lg:inline">Fantasy Calendar</span>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-4 w-px bg-border shrink-0" />

                        {/* Integrated Timeline Controls */}
                        {showTimeline && (
                            <div className="flex items-center gap-3 animate-in fade-in duration-300 overflow-hidden">
                                <Badge variant="outline" className="h-6 gap-1 px-2 font-mono">
                                    {viewYearFormatted}
                                </Badge>

                                <div className="flex items-center border rounded-md bg-muted/20 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-r-none"
                                        onClick={zoomIn}
                                        disabled={scale === 'month'}
                                        title="Zoom In"
                                    >
                                        <ZoomIn className="h-3.5 w-3.5" />
                                    </Button>
                                    <div className="w-px h-4 bg-border" />
                                    <span className="text-[10px] w-14 text-center font-medium uppercase tracking-wide truncate px-1 select-none">
                                        {scale}
                                    </span>
                                    <div className="w-px h-4 bg-border" />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-l-none"
                                        onClick={zoomOut}
                                        disabled={scale === 'century'}
                                        title="Zoom Out"
                                    >
                                        <ZoomOut className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant={showTimeline ? "secondary" : "ghost"}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setShowTimeline(!showTimeline)}
                        >
                            <Clock className="mr-2 h-3.5 w-3.5" />
                            Timeline
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs bg-primary/5 hover:bg-primary/10 border-primary/20" onClick={() => setIsSetupMode(true)}>
                            <PlusCircle className="mr-2 h-3.5 w-3.5" />
                            New Calendar
                        </Button>
                    </div>
                </header>

                {/* Timeline Bar - Controlled by Page State */}
                {showTimeline && (
                    <DualTimeline className="border-b shrink-0" scale={scale} />
                )}

                {/* Slimmer Calendar Info Bar */}
                <div className="px-4 py-2 border-b flex items-center gap-3 bg-muted/5 shrink-0">
                    <h1 className="text-lg font-semibold tracking-tight">{calendar.name}</h1>
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground truncate">
                        {calendar.orbitalMechanics ?
                            `${calendar.orbitalMechanics.starType} system` :
                            `${calendar.months.length} months`
                        }
                        {` • ${calendar.months.reduce((acc, m) => acc + m.days, 0)} days/year`}
                        {calendar.epochs.length > 0 && ` • ${calendar.epochs.length} epochs`}
                    </p>
                </div>

                {/* Calendar Grid Container */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 min-h-0 bg-muted/5">
                        <FantasyCalendarGrid
                            calendar={calendar}
                            viewDate={viewDate}
                            events={events}
                            onNavigateMonth={navigateMonth}
                            onNavigateYear={navigateYear}
                            onAddEvent={(date) => {
                                goToDate(date);
                                toast.info(`Add event for day ${date.dayIndex + 1}`, {
                                    description: 'Use the sidebar to add events!'
                                });
                            }}
                            onDayClick={handleDayClick}
                            onEventClick={handleEventClick}
                        />
                    </div>

                    {/* Narrative Event Editor - Kanban Board */}
                    <div id="narrative-editor-container">
                        <NarrativeEventEditor className="min-h-[600px]" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Wrapper that provides the context
export default function FantasyCalendarPage() {
    return (
        <CalendarProvider>
            <CalendarPageContent />
        </CalendarProvider>
    );
}
