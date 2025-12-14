import React, { useState, useRef, useCallback } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface EditableArrayProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  addButtonText?: string;
  className?: string;
}

export function EditableArray({
  value,
  onChange,
  label,
  placeholder = 'Add item...',
  addButtonText = 'Add',
  className,
}: EditableArrayProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(() => {
    if (newItem.trim()) {
      onChange([...value, newItem.trim()]);
      setNewItem('');
      setIsAdding(false);
    }
  }, [newItem, value, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange]
  );

  const handleStartEdit = useCallback((index: number) => {
    setEditingIndex(index);
    setEditValue(value[index]);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, [value]);

  const handleSaveEdit = useCallback(() => {
    if (editingIndex !== null && editValue.trim()) {
      const newArray = [...value];
      newArray[editingIndex] = editValue.trim();
      onChange(newArray);
    }
    setEditingIndex(null);
    setEditValue('');
  }, [editingIndex, editValue, value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, action: 'add' | 'edit') => {
      if (e.key === 'Enter') {
        if (action === 'add') handleAdd();
        else handleSaveEdit();
      } else if (e.key === 'Escape') {
        if (action === 'add') {
          setIsAdding(false);
          setNewItem('');
        } else {
          setEditingIndex(null);
          setEditValue('');
        }
      }
    },
    [handleAdd, handleSaveEdit]
  );

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      
      {/* Chip list */}
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="pl-2 pr-1 py-0.5 gap-1 text-xs bg-secondary/50 hover:bg-secondary/70 cursor-pointer group"
            onClick={() => handleStartEdit(index)}
          >
            {editingIndex === index ? (
              <Input
                ref={editInputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={(e) => handleKeyDown(e, 'edit')}
                className="h-5 w-20 px-1 text-xs bg-background border-none"
                autoFocus
              />
            ) : (
              <>
                <span>{item}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(index);
                  }}
                  className="h-4 w-4 rounded-full hover:bg-destructive/20 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </Badge>
        ))}
        
        {/* Add button / input */}
        {isAdding ? (
          <div className="flex items-center gap-1">
            <Input
              ref={inputRef}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onBlur={() => {
                if (!newItem.trim()) setIsAdding(false);
                else handleAdd();
              }}
              onKeyDown={(e) => handleKeyDown(e, 'add')}
              placeholder={placeholder}
              className="h-6 w-24 px-2 text-xs bg-background/50 border-border/50"
              autoFocus
            />
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(true)}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3 mr-1" />
            {addButtonText}
          </Button>
        )}
      </div>
    </div>
  );
}
