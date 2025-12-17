import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: any;
  state: 'partial-call' | 'call' | 'result';
  result?: any;
}

interface ToolExecutionLogProps {
  toolInvocations: ToolInvocation[];
  className?: string;
}

export function ToolExecutionLog({ toolInvocations, className }: ToolExecutionLogProps) {
  if (!toolInvocations || toolInvocations.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2 my-2", className)}>
      {toolInvocations.map((invocation) => (
        <ToolItem key={invocation.toolCallId} invocation={invocation} />
      ))}
    </div>
  );
}

function ToolItem({ invocation }: { invocation: ToolInvocation }) {
  const [isOpen, setIsOpen] = useState(false);
  const isComplete = invocation.state === 'result';
  const isError = isComplete && invocation.result?.success === false;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full border rounded-md bg-muted/30">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-xs hover:bg-muted/50 transition-colors rounded-t-md">
        <div className="flex items-center gap-2">
          {isComplete ? (
            isError ? (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            )
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          )}
          <span className="font-mono font-medium">{invocation.toolName}</span>
          <Badge variant="outline" className="text-[10px] px-1 h-4">
            Function
          </Badge>
        </div>
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="p-2 border-t text-xs space-y-2 bg-background/50">
          <div>
            <span className="text-muted-foreground font-semibold">Arguments:</span>
            <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto font-mono text-[10px]">
              {JSON.stringify(invocation.args, null, 2)}
            </pre>
          </div>
          
          {isComplete && (
            <div>
              <span className="text-muted-foreground font-semibold">Result:</span>
              <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto font-mono text-[10px]">
                {JSON.stringify(invocation.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
