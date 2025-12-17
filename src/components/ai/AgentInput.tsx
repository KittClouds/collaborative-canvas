import React, { useState, useRef, useEffect } from 'react';
import { Send, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface AgentInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  stop: () => void;
  className?: string;
}

export function AgentInput({ 
  input, 
  handleInputChange, 
  handleSubmit, 
  isLoading, 
  stop,
  className 
}: AgentInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className={cn("relative flex items-end gap-2 p-2 border-t bg-background", className)}
    >
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Ask the agent..."
        className="min-h-[40px] max-h-[200px] resize-none pr-12 py-3"
        rows={1}
      />
      
      <div className="absolute right-3 bottom-3">
        {isLoading ? (
          <Button 
            type="button" 
            size="icon" 
            variant="destructive" 
            className="h-8 w-8 rounded-full"
            onClick={stop}
          >
            <StopCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button 
            type="submit" 
            size="icon" 
            className="h-8 w-8 rounded-full"
            disabled={!input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
