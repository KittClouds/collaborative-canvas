/**
 * GraphView - Main graph visualization component
 * 
 * Orchestrates data fetching via useGraphData hook and renders
 * using either D3 (2D) or Force3D (3D) renderers.
 */

import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useGraphData } from '@/hooks/useGraphData';
import type { GraphScope, GraphData, Force3DNode, D3Node } from '@/lib/graph/types/graph-types';
import Force3DGraphView, { Force3DGraphRef } from './Force3DGraphView';
import D3GraphView from './D3GraphView';
import { Loader2, AlertCircle, Construction, RotateCcw, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface GraphViewProps {
    scope: GraphScope;
    renderMode: '2d' | '3d';
    onNodeClick?: (nodeId: string, node: any) => void;
    onEdgeClick?: (edgeId: string, edge: any) => void;
    onNodeHover?: (nodeId: string | null) => void;
    className?: string;
}

export default function GraphView({
    scope,
    renderMode,
    onNodeClick,
    onEdgeClick,
    onNodeHover,
    className
}: GraphViewProps) {
    const { data, stats, loading, error, refetch, isEmpty } = useGraphData(scope);
    const fgRef = useRef<Force3DGraphRef>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Handle node click with selection tracking
    const handleNodeClick = useCallback((node: Force3DNode | D3Node) => {
        setSelectedNodeId(node.id);
        onNodeClick?.(node.id, node);

        // Focus camera on node in 3D mode
        if (renderMode === '3d' && fgRef.current) {
            fgRef.current.focusOnNode(node.id);
        }
    }, [renderMode, onNodeClick]);

    // Handle node hover
    const handleNodeHover = useCallback((node: Force3DNode | D3Node | null) => {
        onNodeHover?.(node?.id || null);
    }, [onNodeHover]);

    // Reset camera
    const handleResetCamera = useCallback(() => {
        if (renderMode === '3d' && fgRef.current) {
            fgRef.current.resetCamera();
        }
    }, [renderMode]);

    // Fit to canvas
    const handleFitToCanvas = useCallback(() => {
        if (renderMode === '3d' && fgRef.current) {
            fgRef.current.fitToCanvas();
        }
    }, [renderMode]);

    // Loading state
    if (loading) {
        return (
            <div className={cn("flex flex-col items-center justify-center w-full h-full bg-background", className)}>
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading graph data...</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={cn("flex flex-col items-center justify-center w-full h-full bg-background p-8 text-center", className)}>
                <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                <h3 className="text-lg font-semibold">Failed to Load Graph</h3>
                <p className="text-muted-foreground mt-2 max-w-md">{error.message}</p>
                <Button variant="outline" className="mt-4" onClick={refetch}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                </Button>
            </div>
        );
    }

    // Empty state
    if (isEmpty || !data) {
        return (
            <div className={cn("flex flex-col items-center justify-center w-full h-full bg-background p-8 text-center", className)}>
                <div className="max-w-md space-y-4">
                    <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center">
                        <Construction className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold">No Graph Data Yet</h3>
                        <p className="text-muted-foreground mt-2">
                            Start writing notes and mentioning entities. The graph will populate as relationships are extracted from your content.
                        </p>
                    </div>
                    <Button variant="outline" onClick={refetch}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("w-full h-full relative overflow-hidden", className)}>
            {/* Renderer */}
            {renderMode === '3d' ? (
                <Force3DGraphView
                    ref={fgRef}
                    data={data}
                    onNodeClick={handleNodeClick}
                    onLinkClick={onEdgeClick ? (link) => onEdgeClick(link.id, link) : undefined}
                    onNodeHover={handleNodeHover}
                    selectedNodeId={selectedNodeId}
                />
            ) : (
                <D3GraphView
                    data={data}
                    onNodeClick={handleNodeClick}
                    onLinkClick={onEdgeClick ? (link) => onEdgeClick(link.id, link) : undefined}
                    onNodeHover={handleNodeHover}
                />
            )}

            {/* Stats Overlay */}
            <div className="absolute top-4 right-4 bg-background/80 backdrop-blur border rounded-md p-2 text-xs font-mono z-10 pointer-events-none">
                <div>Nodes: {stats?.nodeCount || 0}</div>
                <div>Edges: {stats?.edgeCount || 0}</div>
                {stats?.averageDegree !== undefined && (
                    <div>Avg Degree: {stats.averageDegree.toFixed(1)}</div>
                )}
            </div>

            {/* Controls (3D mode only) */}
            {renderMode === '3d' && (
                <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                    <Button variant="outline" size="icon" onClick={handleResetCamera} title="Reset Camera">
                        <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleFitToCanvas} title="Fit to Canvas">
                        <Maximize2 className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={refetch} title="Refresh Data">
                        <RotateCcw className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
