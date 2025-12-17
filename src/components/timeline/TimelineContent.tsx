import React from 'react';
import { TimelineItem, TimelineQuery } from '@/lib/timeline/timelineQueries';
import { TimelineViewMode } from './TimelineViewModeSelector';
import { CardsView } from './views/CardsView';
import { CompactView } from './views/CompactView';
import { CalendarView } from './views/CalendarView';
import { TreeView } from './views/TreeView';

// We can reuse StoryTimeline (react-chrono) for 'flow' view if desired,
// or build a horizontal flow. For now, let's map 'flow' to CardsView or placeholder.

interface TimelineContentProps {
    items: TimelineItem[];
    viewMode: TimelineViewMode;
    query: TimelineQuery;
    onNavigate: (id: string) => void;
    onEdit: (id: string) => void;
    onQuickAdd: (parentId: string, type: string) => void;
}

export function TimelineContent({
    items,
    viewMode,
    query,
    onNavigate,
    onEdit,
    onQuickAdd
}: TimelineContentProps) {

    switch (viewMode) {
        case 'cards':
        case 'flow': // Fallback for now to Cards, or maybe horizontal scroll cards
            return (
                <CardsView
                    items={items}
                    query={query}
                    onNavigate={onNavigate}
                    onEdit={onEdit}
                    onQuickAdd={onQuickAdd}
                />
            );

        case 'compact':
            return (
                <CompactView
                    items={items}
                    onNavigate={onNavigate}
                />
            );

        case 'calendar':
            return (
                <CalendarView
                    items={items}
                    onNavigate={onNavigate}
                />
            );

        case 'tree':
            return (
                <TreeView
                    items={items}
                    onNavigate={onNavigate}
                    onQuickAdd={onQuickAdd}
                />
            );

        default:
            return null;
    }
}
