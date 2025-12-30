import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

export interface FantasyDate {
    year: number;
    monthIndex: number;
    dayIndex: number;
    eraId?: string;
}

interface EditableDateProps {
    value: FantasyDate | null;
    onChange: (value: FantasyDate | null) => void;
    label?: string;
    calendarId?: string;
    includeTime?: boolean;
    format?: string;
    className?: string;
    // Calendar context (passed from parent)
    months?: Array<{ name: string; daysInUnit: number }>;
    eras?: Array<{ id: string; name: string; abbreviation?: string }>;
}

export function EditableDate({
    value,
    onChange,
    label,
    months = [
        { name: 'January', daysInUnit: 31 },
        { name: 'February', daysInUnit: 28 },
        { name: 'March', daysInUnit: 31 },
        { name: 'April', daysInUnit: 30 },
        { name: 'May', daysInUnit: 31 },
        { name: 'June', daysInUnit: 30 },
        { name: 'July', daysInUnit: 31 },
        { name: 'August', daysInUnit: 31 },
        { name: 'September', daysInUnit: 30 },
        { name: 'October', daysInUnit: 31 },
        { name: 'November', daysInUnit: 30 },
        { name: 'December', daysInUnit: 31 },
    ],
    eras,
    className,
}: EditableDateProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewYear, setViewYear] = useState(value?.year ?? 1);
    const [viewMonth, setViewMonth] = useState(value?.monthIndex ?? 0);

    const currentMonth = months[viewMonth] || months[0];
    const daysInMonth = currentMonth?.daysInUnit || 30;

    const displayValue = useMemo(() => {
        if (!value) return 'Select date...';
        const month = months[value.monthIndex];
        const monthName = month?.name || `Month ${value.monthIndex + 1}`;
        const era = eras?.find(e => e.id === value.eraId);
        const eraStr = era ? ` ${era.abbreviation || era.name}` : '';
        return `${value.dayIndex + 1} ${monthName}, ${value.year}${eraStr}`;
    }, [value, months, eras]);

    const handleDayClick = (day: number) => {
        onChange({
            year: viewYear,
            monthIndex: viewMonth,
            dayIndex: day,
            eraId: value?.eraId,
        });
        setIsOpen(false);
    };

    const prevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(months.length - 1);
            setViewYear(y => y - 1);
        } else {
            setViewMonth(m => m - 1);
        }
    };

    const nextMonth = () => {
        if (viewMonth === months.length - 1) {
            setViewMonth(0);
            setViewYear(y => y + 1);
        } else {
            setViewMonth(m => m + 1);
        }
    };

    return (
        <div className={cn('space-y-1', className)}>
            {label && (
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
            )}

            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            'w-full justify-start text-left font-normal h-9',
                            !value && 'text-muted-foreground'
                        )}
                    >
                        <Calendar className="mr-2 h-4 w-4" />
                        {displayValue}
                    </Button>
                </PopoverTrigger>

                <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-3">
                        {/* Month/Year navigation */}
                        <div className="flex items-center justify-between mb-3">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="text-sm font-medium">
                                {currentMonth.name} {viewYear}
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Day grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: daysInMonth }, (_, i) => i).map(day => (
                                <Button
                                    key={day}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        'h-8 w-8 p-0 font-normal',
                                        value?.year === viewYear &&
                                        value?.monthIndex === viewMonth &&
                                        value?.dayIndex === day &&
                                        'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                                    )}
                                    onClick={() => handleDayClick(day)}
                                >
                                    {day + 1}
                                </Button>
                            ))}
                        </div>

                        {/* Clear button */}
                        {value && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full mt-2 text-muted-foreground"
                                onClick={() => {
                                    onChange(null);
                                    setIsOpen(false);
                                }}
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
