import { useEffect, useState } from 'react';

/**
 * Hook to track sidebar width for Arborist virtualization
 */
export function useSidebarWidth() {
    const [width, setWidth] = useState(320); // Default sidebar width

    useEffect(() => {
        const sidebar = document.querySelector('[data-sidebar]');
        if (!sidebar) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setWidth(entry.contentRect.width);
            }
        });

        observer.observe(sidebar);

        // Initial measurement
        setWidth(sidebar.getBoundingClientRect().width);

        return () => observer.disconnect();
    }, []);

    return width;
}
