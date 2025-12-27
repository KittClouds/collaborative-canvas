import React, { useRef, useEffect, useMemo, useImperativeHandle, forwardRef, lazy, Suspense } from 'react';
import * as THREE from 'three';
import { Force3DGraphData, Force3DNode, Force3DLink } from '../../lib/graph/projections/types/base';

// Lazy load to avoid SSR/Initial load issues
const ForceGraph3D = lazy(() => import('react-force-graph-3d'));

export interface Force3DGraphViewProps {
    data: Force3DGraphData;
    onNodeClick?: (node: Force3DNode) => void;
    onLinkClick?: (link: Force3DLink) => void;
    onNodeHover?: (node: Force3DNode | null) => void;
    onBackgroundClick?: () => void;
    selectedNodeId?: string | null;
    className?: string;
    width?: number;
    height?: number;
}

export interface Force3DGraphRef {
    focusOnNode: (nodeId: string, duration?: number) => void;
    fitToCanvas: () => void;
    resetCamera: () => void;
}

const Force3DGraphView = forwardRef<Force3DGraphRef, Force3DGraphViewProps>(({
    data,
    onNodeClick,
    onLinkClick,
    onNodeHover,
    onBackgroundClick,
    selectedNodeId,
    className,
    width,
    height
}, ref) => {
    const fgRef = useRef<any>();

    useImperativeHandle(ref, () => ({
        focusOnNode: (nodeId: string, duration = 1000) => {
            const node = data.nodes.find(n => n.id === nodeId);
            if (node && fgRef.current) {
                // Aim at node from a distance
                const distance = 150;
                const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);

                fgRef.current.cameraPosition(
                    { x: (node.x || 0), y: (node.y || 0), z: (node.z || 0) + distance }, // new pos
                    node, // lookAt
                    duration
                );
            }
        },
        fitToCanvas: () => {
            fgRef.current?.zoomToFit(1000, 50);
        },
        resetCamera: () => {
            fgRef.current?.cameraPosition({ x: 0, y: 0, z: 400 }, { x: 0, y: 0, z: 0 }, 1000);
        },
    }));

    // Highlight logic
    const highlightNodes = useMemo(() => {
        const set = new Set<string>();
        if (selectedNodeId) {
            set.add(selectedNodeId);
            data.links.forEach(link => {
                const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
                const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;

                if (sourceId === selectedNodeId) set.add(targetId);
                if (targetId === selectedNodeId) set.add(sourceId);
            });
        }
        return set;
    }, [selectedNodeId, data]);

    // Styling helpers
    const getNodeColor = (node: Force3DNode) => {
        if (highlightNodes.size > 0 && !highlightNodes.has(node.id)) {
            return '#444'; // Dim
        }
        return node.color || '#cccccc';
    };

    const getNodeOpacity = (node: Force3DNode) => {
        if (highlightNodes.size > 0 && !highlightNodes.has(node.id)) return 0.2;
        return 0.9;
    }

    // Generate Geometry based on type
    const getNodeGeometry = (type: string) => {
        switch (type) {
            case 'NOTE': return new THREE.BoxGeometry(6, 6, 6);
            case 'FOLDER': return new THREE.BoxGeometry(10, 8, 4);
            case 'CHARACTER': return new THREE.CapsuleGeometry(3, 8, 4, 8);
            case 'LOCATION': return new THREE.ConeGeometry(5, 10, 6);
            default: return new THREE.SphereGeometry(4);
        }
    };

    return (
        <div className={className} style={{ width: '100%', height: '100%' }}>
            <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading 3D Engine...</div>}>
                <ForceGraph3D
                    ref={fgRef}
                    graphData={data}
                    width={width}
                    height={height}

                    // Nodes
                    nodeLabel="label"
                    nodeColor={getNodeColor}
                    nodeOpacity={0.9} // handled by material in nodeThreeObject if custom used
                    nodeResolution={16}
                    nodeThreeObject={(node: any) => {
                        // Determine color/opacity manually for custom object
                        const color = getNodeColor(node);
                        const opacity = getNodeOpacity(node);

                        const geo = getNodeGeometry(node.type);
                        const mat = new THREE.MeshLambertMaterial({
                            color: color,
                            transparent: true,
                            opacity: opacity
                        });
                        return new THREE.Mesh(geo, mat);
                    }}

                    // Links
                    linkLabel={(link: any) => link.type}
                    linkWidth={(link: any) => highlightNodes.has(link.source.id) && highlightNodes.has(link.target.id) ? 2 : 0.5}
                    linkOpacity={0.4}
                    linkDirectionalArrowLength={3.5}
                    linkDirectionalArrowRelPos={1}

                    // Interaction
                    onNodeClick={onNodeClick}
                    onLinkClick={onLinkClick}
                    onNodeHover={onNodeHover}
                    onBackgroundClick={onBackgroundClick}

                    // Params
                    showNavInfo={false}
                    backgroundColor="#09090b" // Zinc-950
                    d3AlphaDecay={0.02}
                    d3VelocityDecay={0.3}
                />
            </Suspense>
        </div>
    );
});

Force3DGraphView.displayName = 'Force3DGraphView';
export default Force3DGraphView;
