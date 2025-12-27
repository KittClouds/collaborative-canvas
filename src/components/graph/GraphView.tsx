import React, { useMemo, useRef } from 'react';
import { ProjectionScope } from '../../lib/graph/projections/types';
import { useGraphProjection } from '../../hooks/useGraphProjection';
import { useGraphFilters, FilterState } from '../../hooks/useGraphFilters';
import { Force3DRenderer } from '../../lib/graph/renderers/Force3DRenderer';
import { D3Renderer } from '../../lib/graph/renderers/D3Renderer';
import Force3DGraphView, { Force3DGraphRef } from './Force3DGraphView';
import D3GraphView from './D3GraphView';
import { Force3DNode, Force3DLink, D3Node, D3Link } from '../../lib/graph/projections/types/base';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface GraphViewProps {
    scope: ProjectionScope;
    renderMode: '2d' | '3d';
    onNodeClick?: (nodeId: string, node: any) => void;
    onEdgeClick?: (edgeId: string, edge: any) => void;
    onNodeHover?: (nodeId: string | null) => void;
    filterState?: FilterState;
    className?: string;
}

export default function GraphView({
    scope,
    renderMode,
    onNodeClick,
    onEdgeClick,
    onNodeHover,
    filterState,
    className
}: GraphViewProps) {
    const { projection, loading, error } = useGraphProjection(scope);
    const { filteredData } = useGraphFilters(projection);

    const fgRef = useRef<Force3DGraphRef>(null);

    // Transform data for renderer
    const rendererData = useMemo(() => {
        // We treat filteredData as a partial Projection result
        if (renderMode === '3d') {
            return Force3DRenderer.render({
                ...projection!, // preserve stats/scope
                nodes: filteredData.nodes,
                edges: filteredData.edges,
            });
        } else {
            return D3Renderer.render({
                ...projection!,
                nodes: filteredData.nodes,
                edges: filteredData.edges,
            });
        }
    }, [filteredData, renderMode, projection]);

    const handleNodeClick = (node: any) => {
        onNodeClick?.(node.id, node);
        if (renderMode === '3d' && fgRef.current) {
            fgRef.current.focusOnNode(node.id);
        }
    };

    const handleNodeHover = (node: any | null) => {
        onNodeHover?.(node?.id || null);
    };

    if (loading) {
        return (
            <div className={cn("flex flex-col items-center justify-center w-full h-full bg-background", className)}>
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Generating graph projection...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={cn("flex flex-col items-center justify-center w-full h-full bg-background p-8 text-center", className)}>
                <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                <h3 className="text-lg font-semibold">Graph Projection Failed</h3>
                <p className="text-muted-foreground mt-2 max-w-md">{error.message}</p>
            </div>
        );
    }

    if (!projection || projection.nodes.length === 0) {
        return (
            <div className={cn("flex flex-col items-center justify-center w-full h-full bg-background", className)}>
                <p className="text-muted-foreground">No data found in current scope.</p>
            </div>
        );
    }

    return (
        <div className={cn("w-full h-full relative overflow-hidden", className)}>
            {renderMode === '3d' ? (
                <Force3DGraphView
                    ref={fgRef}
                    data={rendererData as any}
                    onNodeClick={handleNodeClick}
                    onLinkClick={onEdgeClick ? (link) => onEdgeClick(link.id, link) : undefined}
                    onNodeHover={handleNodeHover}
                    selectedNodeId={null} // Controlled by parent usually, but hook needed
                />
            ) : (
                <D3GraphView
                    data={rendererData as any}
                    onNodeClick={handleNodeClick}
                    onLinkClick={onEdgeClick ? (link) => onEdgeClick(link.id, link) : undefined}
                    onNodeHover={handleNodeHover}
                />
            )}

            {/* Overlay Stats (Optional, could be moved to Toolbar) */}
            <div className="absolute top-4 right-4 bg-background/80 backdrop-blur border rounded-md p-2 text-xs font-mono z-10 pointer-events-none">
                <div>N: {rendererData.nodes.length}</div>
                <div>E: {rendererData.links.length}</div>
            </div>
        </div>
    );
}
