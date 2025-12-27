import React, { useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Network } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
    GraphView,
    GraphToolbar,
    GraphControls,
    GraphLegend,
    NodeInfoPanel,
    SearchBar
} from '../components/graph';
import { ProjectionScope } from '../lib/graph/projections/types';
import { useGraphInteraction } from '../hooks/useGraphInteraction';
import { FilterState, useGraphFilters } from '../hooks/useGraphFilters';
import { Force3DGraphRef } from '../components/graph/Force3DGraphView';

export default function GraphExplorerPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // State from URL or defaults
    const [scope, setScope] = useState<ProjectionScope>(() => {
        const type = searchParams.get('scope') as any || 'entity';
        const target = searchParams.get('target') as any || 'global';
        const contextId = searchParams.get('context') || undefined;

        if (type === 'obsidian') return { type: 'obsidian', target, folderId: contextId };
        if (type === 'entity') return { type: 'entity', target, contextId };
        return { type: 'concept', target: 'note', contextId: contextId || 'temp' };
    });

    const [renderMode, setRenderMode] = useState<'2d' | '3d'>('3d');
    const [filters, setFilters] = useState<FilterState>({ entityTypes: [], minWeight: 0, dateRange: null });

    const { selectedNodeId, handleNodeClick, handleNodeHover, clearSelection, setSelectedNodeId } = useGraphInteraction();
    const [selectedNodeData, setSelectedNodeData] = useState<any>(null);

    const graphRef = useRef<Force3DGraphRef>(null);

    // Update URL when scope changes
    const updateScope = useCallback((newScope: ProjectionScope) => {
        setScope(newScope);
        const params = new URLSearchParams();
        params.set('scope', newScope.type);
        params.set('target', newScope.target);
        if ('contextId' in newScope && newScope.contextId) params.set('context', newScope.contextId);
        if ('folderId' in newScope && newScope.folderId) params.set('context', newScope.folderId);
        setSearchParams(params);
    }, [setSearchParams]);

    const onNodeClick = useCallback((nodeId: string, node: any) => {
        handleNodeClick({ id: nodeId });
        setSelectedNodeData(node);
    }, [handleNodeClick]);

    const onNodeHover = useCallback((nodeId: string | null) => {
        handleNodeHover(nodeId ? { id: nodeId } : null);
    }, [handleNodeHover]);

    const handleCloseNodeInfo = useCallback(() => {
        clearSelection();
        setSelectedNodeData(null);
    }, [clearSelection]);

    const handleFocusNode = useCallback(() => {
        if (selectedNodeId && graphRef.current) {
            graphRef.current.focusOnNode(selectedNodeId);
        }
    }, [selectedNodeId]);

    const handleSearch = useCallback((query: string) => {
        // TODO: Implement search highlight logic
        console.log('Searching for:', query);
    }, []);

    return (
        <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
            {/* Top Header Bar */}
            <header className="h-12 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur z-30 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Editor
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Network className="h-4 w-4 text-primary" />
                        Graph Explorer
                    </div>
                </div>
                <SearchBar onSearch={handleSearch} />
            </header>

            {/* Main Content Area */}
            <div className="flex-1 relative overflow-hidden">
                {/* Graph Canvas */}
                <GraphView
                    scope={scope}
                    renderMode={renderMode}
                    onNodeClick={onNodeClick}
                    onNodeHover={onNodeHover}
                    filterState={filters}
                    className="absolute inset-0"
                />

                {/* Toolbar Overlay */}
                <GraphToolbar
                    renderMode={renderMode}
                    setRenderMode={setRenderMode}
                    onFit={() => graphRef.current?.fitToCanvas()}
                    onReset={() => graphRef.current?.resetCamera()}
                />

                {/* Legend Overlay */}
                <GraphLegend />

                {/* Node Info Panel (Right Side) */}
                {selectedNodeId && selectedNodeData && (
                    <NodeInfoPanel
                        nodeId={selectedNodeId}
                        nodeData={selectedNodeData}
                        onClose={handleCloseNodeInfo}
                        onFocus={handleFocusNode}
                    />
                )}
            </div>

            {/* Bottom Controls Panel */}
            <GraphControls
                scope={scope}
                setScope={updateScope}
                filters={filters}
                setFilters={setFilters}
                className="shrink-0"
            />
        </div>
    );
}
