import React from 'react';
import { TimelineItem, TimelineQuery } from '@/lib/timeline/timelineQueries';
import { TimelineCard } from '../TimelineCard';

interface CardsViewProps {
    items: TimelineItem[];
    query: TimelineQuery;
    onNavigate: (id: string) => void;
    onEdit: (id: string) => void;
    onQuickAdd: (parentId: string, type: string) => void;
}

export function CardsView({ items, query, onNavigate, onEdit, onQuickAdd }: CardsViewProps) {
    // Group items if necessary
    const groupedItems = React.useMemo(() => {
        if (query.groupBy === 'none') {
            return { 'All Items': items };
        }

        // Group logic
        const groups: Record<string, TimelineItem[]> = {};
        items.forEach(item => {
            const key = item.groupKey || 'Uncategorized';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [items, query.groupBy]);

    return (
        <div className="p-4 space-y-6 pb-20">
            {Object.entries(groupedItems).map(([groupTitle, groupItems]) => (
                <div key={groupTitle} className="space-y-3">
                    {query.groupBy !== 'none' && (
                        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2 border-b">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {groupTitle}
                            </h3>
                        </div>
                    )}

                    <div className="space-y-3">
                        {groupItems.map(item => (
                            <TimelineCard
                                key={item.id}
                                entity={item.entity}
                                mode="standard"
                                onNavigate={() => onNavigate(item.id)}
                                onEdit={() => onEdit(item.id)}
                                onQuickAdd={onQuickAdd}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
