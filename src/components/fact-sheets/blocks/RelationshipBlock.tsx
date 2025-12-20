import React, { useState, useMemo } from 'react';
import { CompiledRelationshipType } from '@/features/blueprint-hub/types';
import type { EntityEdge, Entity } from '@/lib/storage/interfaces';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { Plus, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RelationshipBlockProps {
  definition: CompiledRelationshipType;
  entityId: string;
  entityKind: string;
  edges: EntityEdge[];
  allEntities: Entity[];
  onAdd: (targetId: string) => void;
  onRemove: (edgeId: string) => void;
}

export function RelationshipBlock({
  definition,
  entityId,
  entityKind,
  edges,
  allEntities,
  onAdd,
  onRemove,
}: RelationshipBlockProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Determine if this entity can be source or target
  const canBeSource = definition.source_entity_kind === entityKind;
  const canBeTarget = definition.target_entity_kind === entityKind;

  // Split edges into outgoing and incoming
  const { outgoingEdges, incomingEdges } = useMemo(() => {
    const outgoing = edges.filter(
      (edge) =>
        edge.source_id === entityId &&
        edge.edge_type === definition.relationship_name
    );
    const incoming = edges.filter(
      (edge) =>
        edge.target_id === entityId &&
        edge.edge_type === definition.relationship_name
    );
    return { outgoingEdges: outgoing, incomingEdges: incoming };
  }, [edges, entityId, definition.relationship_name]);

  // Get entity details for connected entities
  const getEntityDetails = (entityIdToFind: string): Entity | undefined => {
    return allEntities.find((e) => e.id === entityIdToFind);
  };

  // Get available targets for selection
  const availableTargets = useMemo(() => {
    if (!canBeSource) return [];

    const connectedIds = new Set(outgoingEdges.map((e) => e.target_id));
    return allEntities.filter(
      (entity) =>
        entity.id !== entityId &&
        entity.entity_kind === definition.target_entity_kind &&
        !connectedIds.has(entity.id)
    );
  }, [canBeSource, allEntities, entityId, definition.target_entity_kind, outgoingEdges]);

  const filteredTargets = useMemo(() => {
    if (!search) return availableTargets;
    const lowerSearch = search.toLowerCase();
    return availableTargets.filter((entity) =>
      entity.name.toLowerCase().includes(lowerSearch)
    );
  }, [availableTargets, search]);

  const handleSelect = (targetId: string) => {
    onAdd(targetId);
    setOpen(false);
    setSearch('');
  };

  const renderEdgeList = (
    edges: EntityEdge[],
    direction: 'outgoing' | 'incoming'
  ) => {
    if (edges.length === 0) return null;

    return (
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          {direction === 'outgoing'
            ? definition.display_label
            : definition.inverse_label || 'Related from'}
        </div>
        {edges.map((edge) => {
          const connectedEntityId =
            direction === 'outgoing' ? edge.target_id : edge.source_id;
          const connectedEntity = getEntityDetails(connectedEntityId);

          if (!connectedEntity) return null;

          return (
            <div
              key={edge.id}
              className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted group"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {direction === 'outgoing' ? (
                  <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ArrowLeft className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-sm truncate">{connectedEntity.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({connectedEntity.entity_kind})
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(edge.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
    );
  };

  // If this entity cannot participate in this relationship at all, don't render
  if (!canBeSource && !canBeTarget) {
    return null;
  }

  return (
    <div className="space-y-3">
      {canBeSource && outgoingEdges.length > 0 && renderEdgeList(outgoingEdges, 'outgoing')}
      {canBeTarget && incomingEdges.length > 0 && renderEdgeList(incomingEdges, 'incoming')}

      {canBeSource && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={availableTargets.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {definition.display_label}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder={`Search ${definition.target_entity_kind}...`}
                value={search}
                onValueChange={setSearch}
              />
              <CommandEmpty>No entities found.</CommandEmpty>
              <CommandGroup className="max-h-[200px] overflow-y-auto">
                {filteredTargets.map((entity) => (
                  <CommandItem
                    key={entity.id}
                    value={entity.id}
                    onSelect={() => handleSelect(entity.id)}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">{entity.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {entity.entity_kind}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
