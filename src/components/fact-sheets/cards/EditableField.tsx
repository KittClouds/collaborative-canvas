import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface EditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  debounceMs?: number;
}

export function EditableField({
  value,
  onChange,
  label,
  placeholder = 'Click to edit...',
  multiline = false,
  className,
  debounceMs = 300,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Sync external value
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  // Focus on edit
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);
      
      // Debounce save
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    // Immediate save on blur
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onChange(localValue);
  }, [onChange, localValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLocalValue(value);
        setIsEditing(false);
      } else if (e.key === 'Enter' && !multiline) {
        handleBlur();
      }
    },
    [value, multiline, handleBlur]
  );

  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      
      {isEditing ? (
        <InputComponent
          ref={inputRef as any}
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'bg-background/50 border-border/50 text-sm',
            multiline && 'min-h-[80px] resize-none'
          )}
        />
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className={cn(
            'px-3 py-2 rounded-md border border-transparent cursor-text transition-colors',
            'hover:border-border/50 hover:bg-background/30',
            'text-sm',
            localValue ? 'text-foreground' : 'text-muted-foreground/60 italic',
            multiline && 'min-h-[60px]'
          )}
        >
          {localValue || placeholder}
        </div>
      )}
    </div>
  );
}
