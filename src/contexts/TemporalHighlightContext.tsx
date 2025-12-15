import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TemporalHighlightContextType {
  // Currently highlighted temporal expression from editor click
  highlightedTemporal: string | null;
  // Set temporal expression to highlight in timeline
  setHighlightedTemporal: (temporal: string | null) => void;
  // Clear highlight
  clearHighlight: () => void;
  // Switch to timeline tab and highlight
  activateTimelineWithTemporal: (temporal: string) => void;
  // Callback for when timeline tab should be activated
  onActivateTimeline?: () => void;
  setOnActivateTimeline: (callback: () => void) => void;
}

const TemporalHighlightContext = createContext<TemporalHighlightContextType | undefined>(undefined);

export function TemporalHighlightProvider({ children }: { children: ReactNode }) {
  const [highlightedTemporal, setHighlightedTemporal] = useState<string | null>(null);
  const [onActivateTimeline, setOnActivateTimelineCallback] = useState<(() => void) | undefined>();

  const clearHighlight = useCallback(() => {
    setHighlightedTemporal(null);
  }, []);

  const activateTimelineWithTemporal = useCallback((temporal: string) => {
    setHighlightedTemporal(temporal);
    // Activate timeline tab
    onActivateTimeline?.();
    // Auto-clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedTemporal(null);
    }, 3000);
  }, [onActivateTimeline]);

  const setOnActivateTimeline = useCallback((callback: () => void) => {
    setOnActivateTimelineCallback(() => callback);
  }, []);

  return (
    <TemporalHighlightContext.Provider 
      value={{ 
        highlightedTemporal, 
        setHighlightedTemporal, 
        clearHighlight,
        activateTimelineWithTemporal,
        onActivateTimeline,
        setOnActivateTimeline
      }}
    >
      {children}
    </TemporalHighlightContext.Provider>
  );
}

export function useTemporalHighlight() {
  const context = useContext(TemporalHighlightContext);
  if (!context) {
    throw new Error('useTemporalHighlight must be used within TemporalHighlightProvider');
  }
  return context;
}
