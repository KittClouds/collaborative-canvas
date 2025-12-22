import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { NEREntity, NERModelStatus } from '@/lib/extraction';

interface NERContextValue {
    // State
    entities: NEREntity[];
    modelStatus: NERModelStatus;
    isAnalyzing: boolean;
    error: string | null;

    // Actions
    setEntities: (entities: NEREntity[] | ((prev: NEREntity[]) => NEREntity[])) => void;
    clearEntities: () => void;
    setModelStatus: (status: NERModelStatus) => void;
    setIsAnalyzing: (analyzing: boolean) => void;
    setError: (error: string | null) => void;
}

const NERContext = createContext<NERContextValue | null>(null);

interface NERProviderProps {
    children: ReactNode;
}

export function NERProvider({ children }: NERProviderProps) {
    const [entities, setEntities] = useState<NEREntity[]>([]);
    const [modelStatus, setModelStatus] = useState<NERModelStatus>('idle');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clearEntities = useCallback(() => {
        setEntities([]);
    }, []);

    const value: NERContextValue = {
        entities,
        modelStatus,
        isAnalyzing,
        error,
        setEntities,
        clearEntities,
        setModelStatus,
        setIsAnalyzing,
        setError,
    };

    return (
        <NERContext.Provider value={value}>
            {children}
        </NERContext.Provider>
    );
}

export function useNER(): NERContextValue {
    const context = useContext(NERContext);
    if (!context) {
        throw new Error('useNER must be used within a NERProvider');
    }
    return context;
}

// Optional hook for components that don't need full context
export function useNEREntities(): NEREntity[] {
    const context = useContext(NERContext);
    return context?.entities ?? [];
}
