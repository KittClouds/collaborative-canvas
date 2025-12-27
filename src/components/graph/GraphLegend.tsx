import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';

export default function GraphLegend({ className }: { className?: string }) {
    const [expanded, setExpanded] = useState(true);

    if (!expanded) {
        return (
            <Button variant="outline" size="sm" className={cn("absolute bottom-4 left-4 z-10", className)} onClick={() => setExpanded(true)}>
                Legend <ChevronUp className="ml-2 h-3 w-3" />
            </Button>
        )
    }

    return (
        <div className={cn("absolute bottom-4 left-4 bg-background/90 backdrop-blur border rounded-lg p-3 w-48 shadow-lg z-10 text-xs", className)}>
            <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Legend</span>
                <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setExpanded(false)}>
                    <ChevronDown className="h-3 w-3" />
                </Button>
            </div>

            <div className="space-y-2">
                <div className="font-medium text-muted-foreground">Node Types</div>
                <div className="grid grid-cols-1 gap-1">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ccc]"></div> Note / Unknown</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#e63946]"></div> Character</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#2a9d8f]"></div> Location</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#e9c46a]"></div> Item</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#f4a261]"></div> Event</div>
                </div>
            </div>
        </div>
    );
}
