import React from 'react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EditableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label?: string;
  placeholder?: string;
  className?: string;
}

export function EditableDropdown({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select...',
  className,
}: EditableDropdownProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger 
          className={cn(
            'h-8 text-sm bg-background/50 border-border/50',
            !value && 'text-muted-foreground'
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-popover border border-border z-50">
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
