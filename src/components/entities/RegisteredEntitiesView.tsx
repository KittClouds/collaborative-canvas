import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { entityRegistry } from '@/lib/entities/entity-registry';
import { ENTITY_COLORS, type EntityKind } from '@/lib/entities/entityTypes';
import { EntityCreationModal } from './EntityCreationModal';
import { EntityDetailModal } from './EntityDetailModal';
import { useEntityRegistry } from '@/hooks/useEntityRegistry';
import type { RegisteredEntity } from '@/lib/entities/types/registry';

export function RegisteredEntitiesView() {
    const { version, refresh } = useEntityRegistry(entityRegistry);
    const [filter, setFilter] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

    const entities = useMemo(() => {
        const all = entityRegistry.getAllEntities();
        if (!filter) return all;
        const lower = filter.toLowerCase();

        return all.filter(e =>
            e.label.toLowerCase().includes(lower) ||
            e.aliases?.some(a => a.toLowerCase().includes(lower))
        );
    }, [version, filter]);

    const grouped = useMemo(() => {
        const groups: Record<string, RegisteredEntity[]> = {};
        for (const entity of entities) {
            if (!groups[entity.kind]) {
                groups[entity.kind] = [];
            }
            groups[entity.kind].push(entity);
        }
        // Sort keys consistent order
        return Object.keys(groups).sort().reduce((obj: any, key) => {
            obj[key] = groups[key];
            return obj;
        }, {});
    }, [entities]);

    return (
        <div className="flex flex-col h-full">
            {/* Header Actions */}
            <div className="px-4 py-3 space-y-3 border-b">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter entities..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="pl-8 h-9"
                    />
                </div>
                <Button onClick={() => setIsCreateOpen(true)} className="w-full gap-2 h-8" size="sm">
                    <Plus className="h-4 w-4" />
                    Create Entity
                </Button>
            </div>

            {/* Entity List */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {Object.entries(grouped).map(([kind, items]: [string, any]) => {
                        const color = ENTITY_COLORS[kind as EntityKind] || '#6b7280';

                        return (
                            <div key={kind} className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                    {kind} ({items.length})
                                </div>
                                <div className="grid gap-2">
                                    {items.map((entity: RegisteredEntity) => (
                                        <div
                                            key={entity.id}
                                            onClick={() => setSelectedEntityId(entity.id)}
                                            className="group flex flex-col p-2.5 rounded-lg border bg-card hover:border-primary/50 cursor-pointer transition-colors"
                                        >
                                            <div className="flex justify-between items-start">
                                                <span className="font-medium text-sm truncate">{entity.label}</span>
                                                {entity.totalMentions > 0 && (
                                                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                        {entity.totalMentions}
                                                    </span>
                                                )}
                                            </div>
                                            {entity.aliases && entity.aliases.length > 0 && (
                                                <div className="text-xs text-muted-foreground truncate mt-1">
                                                    {entity.aliases.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {entities.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            {filter ? 'No matches found.' : 'No entities registered yet.'}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Modals */}
            <EntityCreationModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onEntityCreated={refresh}
            />

            <EntityDetailModal
                isOpen={!!selectedEntityId}
                entityId={selectedEntityId}
                onClose={() => setSelectedEntityId(null)}
                onUpdate={refresh}
            />
        </div>
    );
}
