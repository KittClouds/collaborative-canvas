import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface ProgressBarProps {
  current: number;
  max: number;
  onCurrentChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  label?: string;
  color?: string;
  className?: string;
}

export function ProgressBar({
  current,
  max,
  onCurrentChange,
  onMaxChange,
  label,
  color = 'hsl(var(--primary))',
  className,
}: ProgressBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [editingField, setEditingField] = useState<'current' | 'max' | null>(null);
  const [editValue, setEditValue] = useState('');
  const barRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const percentage = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;

  // Handle drag to adjust current value
  const updateFromPosition = useCallback(
    (clientX: number) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const newValue = Math.round(percent * max);
      onCurrentChange(newValue);
    },
    [max, onCurrentChange]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      updateFromPosition(e.clientX);
    },
    [updateFromPosition]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateFromPosition(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, updateFromPosition]);

  // Focus input on edit start
  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const handleStartEdit = (field: 'current' | 'max') => {
    setEditingField(field);
    setEditValue(String(field === 'current' ? current : max));
  };

  const handleCommitEdit = () => {
    if (!editingField) return;
    const parsed = parseInt(editValue, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      if (editingField === 'current') {
        onCurrentChange(Math.min(parsed, max));
      } else {
        onMaxChange(parsed);
      }
    }
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCommitEdit();
    else if (e.key === 'Escape') {
      setEditingField(null);
      setEditValue('');
    }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      
      {/* Bar container */}
      <div className="flex items-center gap-2">
        {/* Current value */}
        {editingField === 'current' ? (
          <Input
            ref={inputRef}
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCommitEdit}
            onKeyDown={handleKeyDown}
            className="h-6 w-12 px-1 text-xs text-center bg-background/50 border-border/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        ) : (
          <span
            onClick={() => handleStartEdit('current')}
            className="text-xs font-medium text-foreground cursor-pointer hover:underline w-8 text-right"
          >
            {current}
          </span>
        )}

        {/* Progress bar */}
        <div
          ref={barRef}
          onMouseDown={handleMouseDown}
          className={cn(
            'flex-1 h-4 rounded-full bg-muted/50 overflow-hidden cursor-ew-resize relative',
            isDragging && 'cursor-grabbing'
          )}
        >
          {/* Fill */}
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${percentage}%`,
              backgroundColor: color,
            }}
          />
          
          {/* Drag handle indicator */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white/50 transition-opacity"
            style={{
              left: `calc(${percentage}% - 2px)`,
              opacity: isDragging ? 1 : 0,
            }}
          />
        </div>

        {/* Max value */}
        {editingField === 'max' ? (
          <Input
            ref={inputRef}
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCommitEdit}
            onKeyDown={handleKeyDown}
            className="h-6 w-12 px-1 text-xs text-center bg-background/50 border-border/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        ) : (
          <span
            onClick={() => handleStartEdit('max')}
            className="text-xs text-muted-foreground cursor-pointer hover:underline w-8"
          >
            {max}
          </span>
        )}
      </div>
    </div>
  );
}
