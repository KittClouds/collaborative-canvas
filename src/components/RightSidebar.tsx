import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { PanelRightClose, PanelRight, Sparkles, BarChart3, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { FactSheetContainer } from '@/components/fact-sheets/FactSheetContainer';
import { AnalyticsPanel } from '@/components/analytics';
import { TimelinePanel } from '@/components/timeline';
import { useTemporalHighlight } from '@/contexts/TemporalHighlightContext';

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

const RIGHT_TAB_STORAGE_KEY = 'right-sidebar:tab';

// The actual right sidebar component
export function RightSidebar() {
  const { isOpen, open } = useRightSidebar();
  const { setOnActivateTimeline } = useTemporalHighlight();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem(RIGHT_TAB_STORAGE_KEY) || 'entities';
  });

  // Register callback to activate timeline tab from temporal clicks
  useEffect(() => {
    setOnActivateTimeline(() => {
      open();
      setActiveTab('timeline');
    });
  }, [setOnActivateTimeline, open]);

  // Persist tab state
  useEffect(() => {
    localStorage.setItem(RIGHT_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  return (
    <aside
      className={cn(
        'h-full border-l border-border bg-sidebar transition-all duration-300 ease-in-out overflow-hidden flex flex-col',
        isOpen ? 'w-[380px]' : 'w-0'
      )}
    >
      {isOpen && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          {/* Header with Tabs */}
          <div className="shrink-0 border-b border-border">
            <TabsList className="w-full h-12 bg-transparent rounded-none p-0">
              <TabsTrigger 
                value="entities" 
                className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2"
              >
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">Entities</span>
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm">Analytics</span>
              </TabsTrigger>
              <TabsTrigger 
                value="timeline" 
                className="flex-1 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2"
              >
                <Clock className="h-4 w-4" />
                <span className="text-sm">Timeline</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Content */}
          <TabsContent value="entities" className="flex-1 overflow-auto mt-0">
            <FactSheetContainer />
          </TabsContent>
          <TabsContent value="analytics" className="flex-1 overflow-auto mt-0">
            <AnalyticsPanel />
          </TabsContent>
          <TabsContent value="timeline" className="flex-1 overflow-auto mt-0">
            <TimelinePanel />
          </TabsContent>
        </Tabs>
      )}
    </aside>
  );
}
