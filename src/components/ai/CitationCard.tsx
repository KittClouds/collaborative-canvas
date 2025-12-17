import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CitationCardProps {
  noteId: string;
  title: string;
  snippet?: string;
  score?: number;
  onClick?: (noteId: string) => void;
  className?: string;
}

export function CitationCard({ 
  noteId, 
  title, 
  snippet, 
  score, 
  onClick, 
  className 
}: CitationCardProps) {
  return (
    <div 
      className={cn(
        "group relative flex flex-col gap-1 rounded-md border bg-card p-3 shadow-sm hover:bg-accent/50 transition-colors",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-medium text-sm truncate" title={title}>
            {title || 'Untitled Note'}
          </span>
        </div>
        {onClick && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onClick(noteId)}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      {snippet && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {snippet}
        </p>
      )}

      {score !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary/50" 
              style={{ width: `${Math.min(score * 100, 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">
            {Math.round(score * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
