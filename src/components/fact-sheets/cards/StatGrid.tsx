import React, { useState, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Stat {
  name: string;
  abbreviation: string;
  base: number;
  modifier?: number;
}

interface StatGridProps {
  stats: Stat[];
  onChange: (statName: string, value: number) => void;
  label?: string;
  className?: string;
}

export function StatGrid({ stats, onChange, label, className }: StatGridProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
      )}
      
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <StatCell key={stat.name} stat={stat} onChange={onChange} />
        ))}
      </div>
    </div>
  );
}

interface StatCellProps {
  stat: Stat;
  onChange: (statName: string, value: number) => void;
}

function StatCell({ stat, onChange }: StatCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(stat.base));
  const [isHovered, setIsHovered] = useState(false);

  const total = stat.base + (stat.modifier || 0);
  const modifierText = stat.modifier 
    ? stat.modifier > 0 
      ? `+${stat.modifier}` 
      : String(stat.modifier)
    : null;

  const handleCommit = useCallback(() => {
    const parsed = parseInt(localValue, 10);
    if (!isNaN(parsed)) {
      onChange(stat.name, Math.max(0, parsed));
    } else {
      setLocalValue(String(stat.base));
    }
    setIsEditing(false);
  }, [localValue, stat.name, stat.base, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleCommit();
      else if (e.key === 'Escape') {
        setLocalValue(String(stat.base));
        setIsEditing(false);
      }
    },
    [handleCommit, stat.base]
  );

  const increment = () => onChange(stat.name, stat.base + 1);
  const decrement = () => onChange(stat.name, Math.max(0, stat.base - 1));

  return (
    <div
      className="relative rounded-lg border border-border/50 bg-card/50 p-2 text-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Stat abbreviation */}
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
        {stat.abbreviation}
      </div>

      {/* Base value (editable) */}
      {isEditing ? (
        <Input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          className="h-6 w-full text-center text-lg font-bold bg-background/50 border-border/50 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          autoFocus
        />
      ) : (
        <div
          onClick={() => {
            setLocalValue(String(stat.base));
            setIsEditing(true);
          }}
          className="text-lg font-bold text-foreground cursor-pointer hover:text-primary transition-colors"
        >
          {stat.base}
        </div>
      )}

      {/* Modifier (if any) */}
      {modifierText && (
        <div
          className={cn(
            'text-[10px] font-medium',
            stat.modifier! > 0 ? 'text-green-500' : 'text-red-500'
          )}
        >
          ({modifierText})
        </div>
      )}

      {/* Total (if modifier exists) */}
      {stat.modifier !== undefined && stat.modifier !== 0 && (
        <div className="text-xs text-muted-foreground mt-0.5">
          = {total}
        </div>
      )}

      {/* +/- buttons on hover */}
      <div
        className={cn(
          'absolute -top-1 -right-1 flex flex-col gap-0.5 transition-opacity',
          isHovered && !isEditing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <Button
          variant="secondary"
          size="icon"
          className="h-4 w-4 rounded-full"
          onClick={increment}
        >
          <Plus className="h-2 w-2" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-4 w-4 rounded-full"
          onClick={decrement}
          disabled={stat.base <= 0}
        >
          <Minus className="h-2 w-2" />
        </Button>
      </div>
    </div>
  );
}
