import { createContext, useContext, useState, useEffect, useCallback, ReactNode, RefObject } from 'react';
import { flushSync } from 'react-dom';
import { themeActions } from 'reactjs-tiptap-editor/theme';

type Theme = 'light' | 'dark';

const THEME_KEY = 'networked-notes-theme';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (ref?: RefObject<HTMLButtonElement | HTMLElement>) => Promise<void>;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
      themeActions.setTheme('dark');
    } else {
      root.classList.remove('dark');
      themeActions.setTheme('light');
    }
    
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(async (ref?: RefObject<HTMLButtonElement | HTMLElement>) => {
    const supportsViewTransitions = 'startViewTransition' in document;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!ref?.current || !supportsViewTransitions || prefersReducedMotion) {
      setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
      return;
    }

    const { top, left, width, height } = ref.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = (document as any).startViewTransition(() => {
      flushSync(() => {
        setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
      });
    });

    await transition.ready;

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 500,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    );
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
