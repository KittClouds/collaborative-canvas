import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { D3GraphData, D3Node, D3Link } from '@/lib/graph/types/graph-types';

export interface D3GraphViewProps {
    data: D3GraphData;
    onNodeClick?: (node: D3Node) => void;
    onLinkClick?: (link: D3Link) => void;
    onNodeHover?: (node: D3Node | null) => void;
    className?: string;
    width?: number;
    height?: number;
}

export default function D3GraphView({
    data,
    onNodeClick,
    onLinkClick,
    onNodeHover,
    className,
    width = 800,
    height = 600
}: D3GraphViewProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [simulation, setSimulation] = useState<d3.Simulation<D3Node, D3Link> | null>(null);

    // Initialize simulation
    useEffect(() => {
        if (!svgRef.current) return;

        // Clear previous
        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3.select(svgRef.current)
            .attr("viewBox", [0, 0, width, height]);

        // Zoom group
        const g = svg.append("g");

        svg.call(d3.zoom<SVGSVGElement, unknown>()
            .extent([[0, 0], [width, height]])
            .scaleExtent([0.1, 8])
            .on("zoom", ({ transform }) => {
                g.attr("transform", transform);
            }));

        // Data copy to avoid mutating props
        const nodes = data.nodes.map(d => ({ ...d }));
        const links = data.links.map(d => ({ ...d }));

        const sim = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(20));

        // Links
        const link = g.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", d => Math.sqrt(d.weight || 1));

        // Nodes
        const node = g.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", 5)
            .attr("fill", d => d.color || "#ccc")
            // Drag behavior
            .call(d3.drag<SVGCircleElement, D3Node>()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        node.append("title")
            .text(d => d.label);

        // Interaction
        node.on("click", (event, d) => {
            event.stopPropagation();
            onNodeClick?.(d);
        });

        node.on("mouseover", (event, d) => onNodeHover?.(d));
        node.on("mouseout", () => onNodeHover?.(null));

        // Tick
        sim.on("tick", () => {
            link
                .attr("x1", d => (d.source as any).x)
                .attr("y1", d => (d.source as any).y)
                .attr("x2", d => (d.target as any).x)
                .attr("y2", d => (d.target as any).y);

            node
                .attr("cx", d => d.x!)
                .attr("cy", d => d.y!);
        });

        setSimulation(sim);

        function dragstarted(event: any) {
            if (!event.active) sim.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event: any) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event: any) {
            if (!event.active) sim.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        return () => {
            sim.stop();
        };
    }, [data, width, height]);

    return (
        <div className={className}>
            <svg ref={svgRef} width="100%" height="100%" style={{ backgroundColor: '#09090b' }} />
        </div>
    );
}
