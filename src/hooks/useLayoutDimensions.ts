import { useState, useEffect, useCallback } from 'react';

interface LayoutDimensionsOptions {
  includeToolbar?: boolean;
  includeConnections?: boolean;
  headerHeight?: number;
  toolbarHeight?: number;
}

interface LayoutDimensions {
  windowHeight: number;
  windowWidth: number;
  availableHeight: string;
  headerHeight: number;
}

export function useLayoutDimensions(options: LayoutDimensionsOptions = {}): LayoutDimensions {
  const {
    includeToolbar = true,
    headerHeight = 64,
    toolbarHeight = 48,
  } = options;

  const [dimensions, setDimensions] = useState<LayoutDimensions>({
    windowHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
    windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1200,
    availableHeight: 'calc(100vh - 200px)',
    headerHeight,
  });

  const calculateDimensions = useCallback(() => {
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    
    // Calculate available height for the editor
    let reservedHeight = headerHeight;
    if (includeToolbar) {
      reservedHeight += toolbarHeight;
    }
    
    // Add some padding
    reservedHeight += 32;
    
    const availableHeight = `calc(100vh - ${reservedHeight}px)`;

    setDimensions({
      windowHeight,
      windowWidth,
      availableHeight,
      headerHeight,
    });
  }, [includeToolbar, headerHeight, toolbarHeight]);

  useEffect(() => {
    calculateDimensions();

    const handleResize = () => {
      calculateDimensions();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateDimensions]);

  return dimensions;
}
