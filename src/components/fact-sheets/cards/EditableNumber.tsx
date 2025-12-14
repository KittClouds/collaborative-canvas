import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EditableNumberProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
}

export function EditableNumber({
  value,
  onChange,
  label,
  min,
  max,
  step = 1,
  unit,
  className,
}: EditableNumberProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(String(value));
    }
  }, [value, isEditing]);

  // Focus on edit
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const clamp = useCallback(
    (val: number) => {
      let clamped = val;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      return clamped;
    },
    [min, max]
  );

  const handleCommit = useCallback(() => {
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      const clamped = clamp(parsed);
      onChange(clamped);
      setLocalValue(String(clamped));
    } else {
      setLocalValue(String(value));
    }
    setIsEditing(false);
  }, [localValue, clamp, onChange, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLocalValue(String(value));
        setIsEditing(false);
      } else if (e.key === 'Enter') {
        handleCommit();
      }
    },
    [value, handleCommit]
  );

  const increment = useCallback(() => {
    const newValue = clamp(value + step);
    onChange(newValue);
  }, [value, step, clamp, onChange]);

  const decrement = useCallback(() => {
    const newValue = clamp(value - step);
    onChange(newValue);
  }, [value, step, clamp, onChange]);

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      
      <div
        className="flex items-center gap-1"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Decrement button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7 transition-opacity',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
          onClick={decrement}
          disabled={min !== undefined && value <= min}
        >
          <Minus className="h-3 w-3" />
        </Button>

        {/* Value display/input */}
        {isEditing ? (
          <Input
            ref={inputRef}
            type="number"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            min={min}
            max={max}
            step={step}
            className="h-7 w-16 text-center text-sm bg-background/50 border-border/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className={cn(
              'h-7 min-w-[48px] px-2 flex items-center justify-center cursor-text rounded-md',
              'border border-transparent transition-colors',
              'hover:border-border/50 hover:bg-background/30',
              'text-sm font-medium text-foreground'
            )}
          >
            {value}
            {unit && <span className="text-muted-foreground ml-1">{unit}</span>}
          </div>
        )}

        {/* Increment button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7 transition-opacity',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
          onClick={increment}
          disabled={max !== undefined && value >= max}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
