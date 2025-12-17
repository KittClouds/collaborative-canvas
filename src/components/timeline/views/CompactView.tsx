import React from 'react';
import { TimelineItem } from '@/lib/timeline/timelineQueries';
import { TimelineCard } from '../TimelineCard';

interface CompactViewProps {
    items: TimelineItem[];
    onNavigate: (id: string) => void;
}

export function CompactView({ items, onNavigate }: CompactViewProps) {
    return (
        <div className="flex flex-col">
            {items.map(item => (
                <div key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                    <TimelineCard
                        entity={item.entity}
                        mode="compact"
                        onNavigate={() => onNavigate(item.id)}
                        showActions={false}
                    />
                </div>
            ))}
        </div>
    );
}
