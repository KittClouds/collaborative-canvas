import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { PanelRightClose, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FactSheetContainer } from '@/components/fact-sheets/FactSheetContainer';

// Right Sidebar Context (independent from left sidebar)
interface RightSidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const RightSidebarContext = createContext<RightSidebarContextType | undefined>(undefined);

const STORAGE_KEY = 'right-sidebar:state';

interface RightSidebarProviderProps {
  children: ReactNode;
  defaultOpen?: boolean;
}

export function RightSidebarProvider({ children, defaultOpen = true }: RightSidebarProviderProps) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null ? JSON.parse(saved) : defaultOpen;
  });

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(isOpen));
  }, [isOpen]);

  // Keyboard shortcut: Ctrl+Shift+E
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'e') {
        e.preventDefault();
        setIsOpen((prev: boolean) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggle = useCallback(() => setIsOpen((prev: boolean) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <RightSidebarContext.Provider value={{ isOpen, toggle, open, close }}>
      {children}
    </RightSidebarContext.Provider>
  );
}

export function useRightSidebar() {
  const context = useContext(RightSidebarContext);
  if (!context) {
    throw new Error('useRightSidebar must be used within RightSidebarProvider');
  }
  return context;
}

// Trigger button for the right sidebar
export function RightSidebarTrigger({ className }: { className?: string }) {
  const { isOpen, toggle } = useRightSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className={cn('h-8 w-8', className)}
      title={isOpen ? 'Hide entity panel (Ctrl+Shift+E)' : 'Show entity panel (Ctrl+Shift+E)'}
    >
      {isOpen ? (
        <PanelRightClose className="h-4 w-4" />
      ) : (
        <PanelRight className="h-4 w-4" />
      )}
    </Button>
  );
}

// The actual right sidebar component
export function RightSidebar() {
  const { isOpen } = useRightSidebar();

  return (
    <aside
      className={cn(
        'h-full border-l border-border bg-sidebar transition-all duration-300 ease-in-out overflow-hidden flex flex-col',
        isOpen ? 'w-[380px]' : 'w-0'
      )}
    >
      {isOpen && (
        <>
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <span className="font-semibold text-sm text-foreground">Entity Details</span>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            <FactSheetContainer />
          </div>
        </>
      )}
    </aside>
  );
}
