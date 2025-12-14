import { Around } from '@theme-toggles/react';
import '@theme-toggles/react/css/Around.css';
import { useTheme } from '@/hooks/useTheme';
import { useRef } from 'react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const buttonRef = useRef<HTMLElement>(null);
  const isDark = theme === 'dark';

  return (
    <div ref={buttonRef as React.RefObject<HTMLDivElement>} className="flex items-center">
      <Around
        toggled={isDark}
        toggle={() => toggleTheme(buttonRef)}
        duration={750}
        className="text-foreground hover:text-primary transition-colors text-2xl p-1"
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        placeholder=""
        onPointerEnterCapture={() => {}}
        onPointerLeaveCapture={() => {}}
      />
    </div>
  );
}
