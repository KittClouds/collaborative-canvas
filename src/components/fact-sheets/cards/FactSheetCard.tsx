import React, { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface FactSheetCardProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  gradient?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function FactSheetCard({
  title,
  icon: Icon,
  gradient = 'from-primary to-primary/70',
  defaultOpen = true,
  children,
  className,
  actions,
}: FactSheetCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn('group', className)}>
      <div className="rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
        {/* Gradient Header */}
        <CollapsibleTrigger className="w-full">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors',
              'bg-gradient-to-r',
              gradient
            )}
          >
            {Icon && <Icon className="h-4 w-4 text-white/90" />}
            <span className="text-sm font-medium text-white flex-1 text-left">{title}</span>
            {actions && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {actions}
              </div>
            )}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-white/70 transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </div>
        </CollapsibleTrigger>

        {/* Content */}
        <CollapsibleContent>
          <div className="p-3 space-y-3">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
