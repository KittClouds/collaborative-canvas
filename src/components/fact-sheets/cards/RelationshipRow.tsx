import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface RelationshipRowProps {
  name: string;
  type: string;
  standing: number; // -100 to 100
  faction?: string;
  onStandingChange: (value: number) => void;
  onClick?: () => void;
  className?: string;
}

export function RelationshipRow({
  name,
  type,
  standing,
  faction,
  onStandingChange,
  onClick,
  className,
}: RelationshipRowProps) {
  const [isEditingStanding, setIsEditingStanding] = useState(false);
  const [standingValue, setStandingValue] = useState(String(standing));

  // Normalize standing to -100 to 100 range
  const normalizedStanding = Math.max(-100, Math.min(100, standing));
  
  // Convert to 0-100 percentage for bar display
  const barPercent = ((normalizedStanding + 100) / 200) * 100;

  // Determine color based on standing
  const getStandingColor = (value: number) => {
    if (value >= 50) return 'hsl(142, 76%, 36%)'; // green
    if (value >= 20) return 'hsl(142, 76%, 50%)'; // light green
    if (value >= -20) return 'hsl(45, 93%, 47%)'; // yellow/neutral
    if (value >= -50) return 'hsl(25, 95%, 53%)'; // orange
    return 'hsl(0, 84%, 60%)'; // red
  };

  const getTypeColor = (t: string) => {
    const colors: Record<string, string> = {
      ally: 'bg-green-500/20 text-green-500',
      friend: 'bg-emerald-500/20 text-emerald-500',
      neutral: 'bg-yellow-500/20 text-yellow-500',
      rival: 'bg-orange-500/20 text-orange-500',
      enemy: 'bg-red-500/20 text-red-500',
    };
    return colors[t.toLowerCase()] || 'bg-muted text-muted-foreground';
  };

  const handleCommitStanding = useCallback(() => {
    const parsed = parseInt(standingValue, 10);
    if (!isNaN(parsed)) {
      onStandingChange(Math.max(-100, Math.min(100, parsed)));
    } else {
      setStandingValue(String(standing));
    }
    setIsEditingStanding(false);
  }, [standingValue, standing, onStandingChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleCommitStanding();
      else if (e.key === 'Escape') {
        setStandingValue(String(standing));
        setIsEditingStanding(false);
      }
    },
    [handleCommitStanding, standing]
  );

  return (
    <div
      className={cn(
        'rounded-lg border border-border/50 bg-card/50 p-2 space-y-1.5',
        className
      )}
    >
      {/* Name and type row */}
      <div className="flex items-center gap-2">
        <span
          onClick={onClick}
          className={cn(
            'text-sm font-medium text-foreground flex-1 truncate',
            onClick && 'cursor-pointer hover:text-primary hover:underline'
          )}
        >
          {name}
        </span>
        <Badge variant="secondary" className={cn('text-[10px] px-1.5', getTypeColor(type))}>
          {type}
        </Badge>
      </div>

      {/* Faction (if any) */}
      {faction && (
        <div className="text-[10px] text-muted-foreground truncate">
          {faction}
        </div>
      )}

      {/* Standing bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-muted/50 relative overflow-hidden">
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted-foreground/30" />
          
          {/* Fill from center */}
          <div
            className="absolute top-0 bottom-0 transition-all duration-150"
            style={{
              left: normalizedStanding >= 0 ? '50%' : `${barPercent}%`,
              right: normalizedStanding >= 0 ? `${100 - barPercent}%` : '50%',
              backgroundColor: getStandingColor(normalizedStanding),
            }}
          />
        </div>

        {/* Standing value */}
        {isEditingStanding ? (
          <Input
            type="number"
            value={standingValue}
            onChange={(e) => setStandingValue(e.target.value)}
            onBlur={handleCommitStanding}
            onKeyDown={handleKeyDown}
            min={-100}
            max={100}
            className="h-5 w-12 px-1 text-[10px] text-center bg-background/50 border-border/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            autoFocus
          />
        ) : (
          <span
            onClick={() => {
              setStandingValue(String(standing));
              setIsEditingStanding(true);
            }}
            className={cn(
              'text-[10px] font-medium w-8 text-right cursor-pointer hover:underline',
              normalizedStanding >= 0 ? 'text-green-500' : 'text-red-500'
            )}
          >
            {normalizedStanding >= 0 ? '+' : ''}{normalizedStanding}
          </span>
        )}
      </div>
    </div>
  );
}
