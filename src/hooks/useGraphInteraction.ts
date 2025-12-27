import { useState } from 'react';
import { Force3DNode } from '../lib/graph/projections/types/base';

export function useGraphInteraction() {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    // We accept generalized node type which has an id
    const handleNodeClick = (node: { id: string }) => {
        setSelectedNodeId(prev => prev === node.id ? null : node.id);
    };

    const handleNodeHover = (node: { id: string } | null) => {
        setHoveredNodeId(node?.id || null);
    };

    return {
        selectedNodeId,
        hoveredNodeId,
        handleNodeClick,
        handleNodeHover,
        clearSelection: () => setSelectedNodeId(null),
        setSelectedNodeId,
    };
}
