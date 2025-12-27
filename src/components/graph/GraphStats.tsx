import React from 'react';
import { cn } from '../../lib/utils';

export interface GraphStatsProps {
    nodeCount: number;
    edgeCount: number;
    density?: number;
    className?: string;
}

export default function GraphStats({ nodeCount, edgeCount, density, className }: GraphStatsProps) {
    return (
        <div className={cn(
            "bg-background/80 backdrop-blur border rounded-md p-3 text-xs font-mono select-none pointer-events-none",
            className
        )}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="text-muted-foreground">Nodes</div>
                <div className="text-right font-bold">{nodeCount}</div>

                <div className="text-muted-foreground">Edges</div>
                <div className="text-right font-bold">{edgeCount}</div>

                {density !== undefined && (
                    <>
                        <div className="text-muted-foreground">Density</div>
                        <div className="text-right">{density.toFixed(3)}</div>
                    </>
                )}
            </div>
        </div>
    );
}
