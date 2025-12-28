import React, { createContext, useContext, useEffect, useState } from 'react';
import { ENTITY_COLORS, EntityKind, ENTITY_KINDS } from '@/lib/entities/entityTypes';

// Type for the theme mapping
export type EntityTheme = Record<EntityKind, string>;

interface EntityThemeContextType {
    theme: EntityTheme;
    updateTheme: (kind: EntityKind, color: string) => void;
    resetTheme: () => void;
    getVar: (kind: string) => string; // Helper to get CSS var name
}

const EntityThemeContext = createContext<EntityThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'galaxy_entity_theme';

// Helper to convert Hex to HSL
function hexToHSL(hex: string): string {
    // Remove hash
    hex = hex.replace('#', '');

    // Parse RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    // Find min/max
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    // Convert to CSS values
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return `${h} ${s}% ${l}%`;
}

export function EntityThemeProvider({ children }: { children: React.ReactNode }) {
    // Initialize state from Storage or Default
    const [theme, setTheme] = useState<EntityTheme>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Merge with defaults to handle any new keys
                    return { ...ENTITY_COLORS, ...parsed };
                } catch (e) {
                    console.error("Failed to parse entity theme", e);
                }
            }
        }
        return { ...ENTITY_COLORS };
    });

    // Initial load effect for SSR safety
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setTheme(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error("Failed to parse entity theme", e);
            }
        }
    }, []);

    // Persist and Inject CSS Variables
    useEffect(() => {
        // Persist
        localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));

        // Inject Styles
        const root = document.documentElement;

        Object.entries(theme).forEach(([kind, hex]) => {
            const varName = `--entity-${kind.toLowerCase().replace('_', '-')}`;
            const hsl = hexToHSL(hex);
            root.style.setProperty(varName, hsl);
        });

    }, [theme]);

    const updateTheme = (kind: EntityKind, color: string) => {
        setTheme(prev => ({ ...prev, [kind]: color }));
    };

    const resetTheme = () => {
        setTheme({ ...ENTITY_COLORS });
    };

    const getVar = (kind: string) => {
        return `var(--entity-${kind.toLowerCase().replace('_', '-')})`;
    };

    return (
        <EntityThemeContext.Provider value={{ theme, updateTheme, resetTheme, getVar }}>
            {children}
        </EntityThemeContext.Provider>
    );
}

export function useEntityTheme() {
    const context = useContext(EntityThemeContext);
    if (context === undefined) {
        throw new Error('useEntityTheme must be used within an EntityThemeProvider');
    }
    return context;
}
