import React from 'react';
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';

interface GraphToolbarProps {
    renderMode: '2d' | '3d';
    setRenderMode: (mode: '2d' | '3d') => void;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onFit?: () => void;
    onReset?: () => void;
}

export default function GraphToolbar({
    renderMode,
    setRenderMode,
    onZoomIn,
    onZoomOut,
    onFit,
    onReset
}: GraphToolbarProps) {
    return (
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
            <div className="pointer-events-auto bg-background/90 backdrop-blur border rounded-lg p-1 shadow-sm">
                <Tabs value={renderMode} onValueChange={(v) => setRenderMode(v as any)}>
                    <TabsList className="h-8">
                        <TabsTrigger value="3d" className="text-xs">3D</TabsTrigger>
                        <TabsTrigger value="2d" className="text-xs">2D</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="pointer-events-auto bg-background/90 backdrop-blur border rounded-lg p-1 shadow-sm flex gap-1">
                {/* Note: ZoomIn/Out logic for 3D/2D differs significantly.
             For now, we just wire the buttons if handler provided.
         */}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFit} title="Fit to Canvas">
                    <Maximize className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onReset} title="Reset Camera">
                    <RotateCcw className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
