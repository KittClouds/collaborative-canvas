import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { NEREntity } from '@/lib/extraction';
import { EntityCard } from './EntityCard';

interface VirtualizedEntityListProps {
    entities: NEREntity[];
    onAccept: (entity: NEREntity, kind: string) => void;
    onDismiss: (entity: NEREntity) => void;
    entityTypes?: Array<{ entity_kind: string; color?: string; display_name: string }>;
    getLabelMappings: Record<string, string[]>;
}

export function VirtualizedEntityList({
    entities,
    onAccept,
    onDismiss,
    entityTypes,
    getLabelMappings
}: VirtualizedEntityListProps) {
    const parentRef = useRef<HTMLDivElement>(null);

    // ✅ Only render visible items
    const virtualizer = useVirtualizer({
        count: entities.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 120, // Estimated height of EntityCard
        overscan: 5, // Render 5 items above/below viewport
    });

    return (
        <div ref={parentRef} className="flex-1 overflow-auto p-4 custom-scrollbar">
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                    const entity = entities[virtualRow.index];
                    // For entities from extraction model, the entity_type IS already the kind
                    // For NER, we use the label mappings
                    const possibleKinds = getLabelMappings[entity.entity_type.toLowerCase()] || [entity.entity_type];

                    return (
                        <div
                            key={virtualRow.key}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                                paddingBottom: '12px' // Gap between cards
                            }}
                        >
                            <EntityCard
                                entity={entity}
                                onAccept={onAccept}
                                onDismiss={onDismiss}
                                entityTypes={entityTypes}
                                possibleKinds={possibleKinds}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
