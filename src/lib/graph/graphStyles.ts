import type { Stylesheet } from 'cytoscape';
import { ENTITY_COLORS } from '@/lib/entities/entityTypes';

export function getGraphStyles(): Stylesheet[] {
  return [
    {
      selector: 'node',
      style: {
        'label': 'data(label)',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '12px',
        'text-wrap': 'wrap',
        'text-max-width': '80px',
      },
    },

    {
      selector: 'node[type = "FOLDER"]',
      style: {
        'background-color': '#4f46e5',
        'shape': 'roundrectangle',
        'width': '60px',
        'height': '40px',
        'border-width': 2,
        'border-color': '#3730a3',
      },
    },

    {
      selector: 'node[type = "NOTE"]',
      style: {
        'background-color': '#06b6d4',
        'shape': 'rectangle',
        'width': '50px',
        'height': '35px',
      },
    },

    {
      selector: 'node[type = "ENTITY"]',
      style: {
        'background-color': 'data(color)',
        'width': 'data(size)',
        'height': 'data(size)',
        'shape': 'ellipse',
      },
    },

    {
      selector: 'node[type = "BLUEPRINT"]',
      style: {
        'background-color': '#fbbf24',
        'shape': 'roundrectangle',
        'width': '50px',
        'height': '50px',
        'border-width': 3,
        'border-color': '#d97706',
        'border-style': 'dashed',
      },
    },

    {
      selector: 'node[type = "TEMPORAL"]',
      style: {
        'background-color': '#eab308',
        'shape': 'diamond',
        'width': '40px',
        'height': '40px',
      },
    },

    ...Object.entries(ENTITY_COLORS).map(([kind, color]) => ({
      selector: `node.kind-${kind.toLowerCase()}`,
      style: {
        'background-color': color,
      },
    })),

    {
      selector: 'node.kind-narrative',
      style: {
        'shape': 'hexagon',
        'width': '60px',
        'height': '60px',
      },
    },

    {
      selector: 'node.kind-arc',
      style: {
        'shape': 'roundrectangle',
        'width': '70px',
        'height': '45px',
      },
    },

    {
      selector: 'node.kind-act',
      style: {
        'shape': 'roundrectangle',
        'width': '60px',
        'height': '40px',
      },
    },

    {
      selector: 'node.kind-chapter',
      style: {
        'shape': 'rectangle',
        'width': '55px',
        'height': '35px',
      },
    },

    {
      selector: 'node.kind-scene',
      style: {
        'shape': 'ellipse',
        'width': '50px',
        'height': '50px',
      },
    },

    {
      selector: 'node.kind-beat',
      style: {
        'shape': 'ellipse',
        'width': '30px',
        'height': '30px',
      },
    },

    {
      selector: 'node.kind-event',
      style: {
        'shape': 'star',
        'width': '45px',
        'height': '45px',
      },
    },

    {
      selector: 'node.kind-timeline',
      style: {
        'shape': 'rectangle',
        'width': '80px',
        'height': '25px',
      },
    },

    {
      selector: 'node.kind-character',
      style: {
        'shape': 'ellipse',
      },
    },

    {
      selector: 'node.kind-location',
      style: {
        'shape': 'pentagon',
      },
    },

    {
      selector: 'node.kind-item',
      style: {
        'shape': 'diamond',
      },
    },

    {
      selector: 'node.kind-faction',
      style: {
        'shape': 'hexagon',
      },
    },

    {
      selector: 'node.pinned',
      style: {
        'border-width': 3,
        'border-color': '#ef4444',
      },
    },

    {
      selector: 'node.favorite',
      style: {
        'border-width': 2,
        'border-color': '#fbbf24',
      },
    },

    {
      selector: ':parent',
      style: {
        'background-opacity': 0.2,
        'border-width': 2,
        'border-color': '#6366f1',
        'background-color': '#e0e7ff',
      },
    },

    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#94a3b8',
        'target-arrow-color': '#94a3b8',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 0.8,
      },
    },

    {
      selector: 'edge.type-contains',
      style: {
        'line-color': '#6366f1',
        'target-arrow-color': '#6366f1',
        'line-style': 'solid',
      },
    },

    {
      selector: 'edge.type-parent_of',
      style: {
        'line-color': '#8b5cf6',
        'target-arrow-color': '#8b5cf6',
        'line-style': 'solid',
        'width': 3,
      },
    },

    {
      selector: 'edge.type-backlink',
      style: {
        'line-color': '#10b981',
        'target-arrow-color': '#10b981',
        'target-arrow-shape': 'triangle',
        'source-arrow-shape': 'triangle',
        'source-arrow-color': '#10b981',
      },
    },

    {
      selector: 'edge.type-mentions',
      style: {
        'line-color': '#f59e0b',
        'target-arrow-color': '#f59e0b',
        'line-style': 'dashed',
      },
    },

    {
      selector: 'edge.type-references',
      style: {
        'line-color': '#64748b',
        'target-arrow-color': '#64748b',
        'line-style': 'dotted',
      },
    },

    {
      selector: 'edge.type-co_occurs',
      style: {
        'line-color': '#ec4899',
        'target-arrow-shape': 'none',
        'width': 'data(weight)',
      },
    },

    {
      selector: 'edge.type-knows',
      style: {
        'line-color': '#8b5cf6',
        'target-arrow-shape': 'none',
      },
    },

    {
      selector: 'edge.type-located_in',
      style: {
        'line-color': '#3b82f6',
        'target-arrow-color': '#3b82f6',
      },
    },

    {
      selector: 'edge.type-owns',
      style: {
        'line-color': '#10b981',
        'target-arrow-color': '#10b981',
      },
    },

    {
      selector: 'edge.type-member_of',
      style: {
        'line-color': '#ef4444',
        'target-arrow-color': '#ef4444',
      },
    },

    {
      selector: 'edge.type-instance_of',
      style: {
        'line-color': '#fbbf24',
        'target-arrow-color': '#fbbf24',
        'line-style': 'dashed',
      },
    },

    {
      selector: 'edge.type-conforms_to',
      style: {
        'line-color': '#d97706',
        'target-arrow-color': '#d97706',
        'line-style': 'dotted',
      },
    },

    {
      selector: 'edge.type-before',
      style: {
        'line-color': '#0ea5e9',
        'target-arrow-color': '#0ea5e9',
      },
    },

    {
      selector: 'edge.type-after',
      style: {
        'line-color': '#0ea5e9',
        'target-arrow-color': '#0ea5e9',
      },
    },

    {
      selector: 'edge.type-during',
      style: {
        'line-color': '#06b6d4',
        'target-arrow-color': '#06b6d4',
        'line-style': 'dashed',
      },
    },

    {
      selector: 'edge.type-caused_by',
      style: {
        'line-color': '#dc2626',
        'target-arrow-color': '#dc2626',
        'width': 3,
      },
    },

    {
      selector: 'edge.type-leads_to',
      style: {
        'line-color': '#f97316',
        'target-arrow-color': '#f97316',
      },
    },

    {
      selector: 'edge.bidirectional',
      style: {
        'source-arrow-shape': 'triangle',
      },
    },

    {
      selector: 'node:selected',
      style: {
        'border-width': 4,
        'border-color': '#2563eb',
        'background-blacken': -0.1,
      },
    },

    {
      selector: 'edge:selected',
      style: {
        'line-color': '#2563eb',
        'target-arrow-color': '#2563eb',
        'source-arrow-color': '#2563eb',
        'width': 4,
      },
    },

    {
      selector: 'node:active',
      style: {
        'overlay-color': '#2563eb',
        'overlay-padding': 10,
        'overlay-opacity': 0.25,
      },
    },
  ];
}

export function getTimelineStyles(): Stylesheet[] {
  return [
    ...getGraphStyles(),
    
    {
      selector: 'node',
      style: {
        'text-valign': 'bottom',
        'text-margin-y': 10,
      },
    },
  ];
}

export function getMinimalStyles(): Stylesheet[] {
  return [
    {
      selector: 'node',
      style: {
        'background-color': '#64748b',
        'width': 20,
        'height': 20,
      },
    },
    {
      selector: 'edge',
      style: {
        'width': 1,
        'line-color': '#cbd5e1',
        'target-arrow-shape': 'none',
      },
    },
  ];
}
