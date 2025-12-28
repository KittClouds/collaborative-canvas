import { cn } from "@/lib/utils";
import React from "react";

export const GraphLogo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 200 200"
            fill="none"
            className={cn("w-full h-full", className)}
            {...props}
        >
            {/* Edges */}
            <line x1="111.3" y1="85.8" x2="93.9" y2="143.3" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="111.3" y1="85.8" x2="117.5" y2="126.4" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="111.3" y1="85.8" x2="130.9" y2="40.0" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="111.3" y1="85.8" x2="75.3" y2="94.7" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="93.9" y1="143.3" x2="68.1" y2="179.3" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="93.9" y1="143.3" x2="117.5" y2="126.4" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="93.9" y1="143.3" x2="59.7" y2="102.9" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="93.9" y1="143.3" x2="133.1" y2="180.0" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="130.9" y1="40.0" x2="98.7" y2="20.0" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="130.9" y1="40.0" x2="144.6" y2="99.5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="68.1" y1="179.3" x2="104.8" y2="145.7" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="68.1" y1="179.3" x2="70.6" y2="143.1" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="68.1" y1="179.3" x2="28.4" y2="173.3" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="98.7" y1="20.0" x2="100.0" y2="80.8" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="98.7" y1="20.0" x2="65.9" y2="42.4" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="104.8" y1="145.7" x2="100.0" y2="80.8" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="104.8" y1="145.7" x2="75.3" y2="94.7" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="104.8" y1="145.7" x2="151.7" y2="156.5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="100.0" y1="80.8" x2="59.7" y2="102.9" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="100.0" y1="80.8" x2="144.6" y2="99.5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="65.9" y1="42.4" x2="59.7" y2="102.9" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="65.9" y1="42.4" x2="75.3" y2="94.7" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="59.7" y1="102.9" x2="75.3" y2="94.7" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="59.7" y1="102.9" x2="20.0" y2="128.2" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="59.7" y1="102.9" x2="41.7" y2="129.5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="59.7" y1="102.9" x2="70.6" y2="143.1" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="75.3" y1="94.7" x2="41.7" y2="129.5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20.0" y1="128.2" x2="41.7" y2="129.5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20.0" y1="128.2" x2="28.4" y2="173.3" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="41.7" y1="129.5" x2="70.6" y2="143.1" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="41.7" y1="129.5" x2="28.4" y2="173.3" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="70.6" y1="143.1" x2="117.5" y2="126.4" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="133.1" y1="180.0" x2="151.7" y2="156.5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="133.1" y1="180.0" x2="149.7" y2="137.0" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="180.0" y1="126.7" x2="151.7" y2="156.5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="180.0" y1="126.7" x2="144.6" y2="99.5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="151.7" y1="156.5" x2="144.6" y2="99.5" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="144.6" y1="99.5" x2="149.7" y2="137.0" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="144.6" y1="99.5" x2="117.5" y2="126.4" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="149.7" y1="137.0" x2="117.5" y2="126.4" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />

            {/* Nodes */}
            <circle cx="111.3" cy="85.8" r="4" fill="#64748b" stroke="white" strokeWidth="1.5" />
            <circle cx="93.9" cy="143.3" r="6" fill="#64748b" stroke="white" strokeWidth="1.5" />
            <circle cx="130.9" cy="40.0" r="4" fill="#14b8a6" stroke="white" strokeWidth="1.5" />
            <circle cx="130.9" cy="40.0" r="1.6" fill="white" fillOpacity="0.3" />
            <circle cx="68.1" cy="179.3" r="4" fill="#14b8a6" stroke="white" strokeWidth="1.5" />
            <circle cx="68.1" cy="179.3" r="1.6" fill="white" fillOpacity="0.3" />
            <circle cx="98.7" cy="20.0" r="4" fill="#14b8a6" stroke="white" strokeWidth="1.5" />
            <circle cx="98.7" cy="20.0" r="1.6" fill="white" fillOpacity="0.3" />
            <circle cx="104.8" cy="145.7" r="4" fill="#14b8a6" stroke="white" strokeWidth="1.5" />
            <circle cx="104.8" cy="145.7" r="1.6" fill="white" fillOpacity="0.3" />
            <circle cx="100.0" cy="80.8" r="4" fill="#14b8a6" stroke="white" strokeWidth="1.5" />
            <circle cx="100.0" cy="80.8" r="1.6" fill="white" fillOpacity="0.3" />
            <circle cx="65.9" cy="42.4" r="4" fill="#64748b" stroke="white" strokeWidth="1.5" />
            <circle cx="59.7" cy="102.9" r="6" fill="#64748b" stroke="white" strokeWidth="1.5" />
            <circle cx="75.3" cy="94.7" r="6" fill="#14b8a6" stroke="white" strokeWidth="1.5" />
            <circle cx="75.3" cy="94.7" r="2.4" fill="white" fillOpacity="0.3" />
            <circle cx="20.0" cy="128.2" r="4" fill="#64748b" stroke="white" strokeWidth="1.5" />
            <circle cx="41.7" cy="129.5" r="6" fill="#14b8a6" stroke="white" strokeWidth="1.5" />
            <circle cx="41.7" cy="129.5" r="2.4" fill="white" fillOpacity="0.3" />
            <circle cx="28.4" cy="173.3" r="4" fill="#64748b" stroke="white" strokeWidth="1.5" />
            <circle cx="70.6" cy="143.1" r="4" fill="#14b8a6" stroke="white" strokeWidth="1.5" />
            <circle cx="70.6" cy="143.1" r="1.6" fill="white" fillOpacity="0.3" />
            <circle cx="133.1" cy="180.0" r="4" fill="#14b8a6" stroke="white" strokeWidth="1.5" />
            <circle cx="133.1" cy="180.0" r="1.6" fill="white" fillOpacity="0.3" />
            <circle cx="180.0" cy="126.7" r="4" fill="#64748b" stroke="white" strokeWidth="1.5" />
            <circle cx="151.7" cy="156.5" r="4" fill="#64748b" stroke="white" strokeWidth="1.5" />
            <circle cx="144.6" cy="99.5" r="6" fill="#64748b" stroke="white" strokeWidth="1.5" />
            <circle cx="149.7" cy="137.0" r="4" fill="#64748b" stroke="white" strokeWidth="1.5" />
            <circle cx="117.5" cy="126.4" r="6" fill="#14b8a6" stroke="white" strokeWidth="1.5" />
            <circle cx="117.5" cy="126.4" r="2.4" fill="white" fillOpacity="0.3" />
        </svg>
    );
};
