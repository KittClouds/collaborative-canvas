/**
 * RelationshipEditorCard - Full relationship management in Fact Sheets
 * 
 * Features:
 * - Lists existing relationships grouped by type
 * - Inline relationship creation
 * - Blueprint picker integration
 * - Network membership display
 * - Delete/edit relationship instances
 * - Cross-navigation to related entities
 */

import React, { useState, useCallback } from 'react';
import {
    Network,
    Plus,
    Trash2,
    ArrowRight,
    ArrowLeftRight,
    ChevronRight,
    Users,
    Loader2,
    AlertCircle,
    ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ENTITY_COLORS, ENTITY_ICONS, type EntityKind } from '@/lib/types/entityTypes';
import { FactSheetCard } from './FactSheetCard';
import { RelationshipDetailsPanel } from './RelationshipDetailsPanel';
import { useEntityRelationships } from '@/hooks/useEntityRelationships';
import { useEntitySelection } from '@/contexts/EntitySelectionContext';
import type { ParsedEntity } from '@/types/factSheetTypes';
import type {
    ResolvedRelationshipInstance,
    GroupedRelationships,
    ApplicableRelationshipType,
    CandidateEntity,
    RelationshipInstanceUpdate,
} from '@/lib/relationships/relationshipBridgeTypes';

interface RelationshipEditorCardProps {
    entity: ParsedEntity;
    onRelationshipChange?: () => void;
}

export function RelationshipEditorCard({
    entity,
    onRelationshipChange,
}: RelationshipEditorCardProps) {
    const {
        groupedRelationships,
        applicableTypes,
        isLoading,
        error,
        createRelationship,
        updateRelationship,
        deleteRelationship,
        getCandidates,
        refresh,
    } = useEntityRelationships(entity);

    const { setSelectedEntity } = useEntitySelection();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    // Navigate to a related entity's Fact Sheet
    const handleNavigateToEntity = useCallback((targetEntity: { id: string; name: string; kind: EntityKind; noteId?: string }) => {
        // Create a ParsedEntity from the resolved entity reference
        const parsedEntity: ParsedEntity = {
            kind: targetEntity.kind,
            label: targetEntity.name,
            noteId: targetEntity.noteId || targetEntity.id,
            attributes: {},
        };
        setSelectedEntity(parsedEntity);
    }, [setSelectedEntity]);

    const handleDelete = useCallback(async (relationshipId: string) => {
        const success = await deleteRelationship(relationshipId);
        if (success) {
            onRelationshipChange?.();
        }
    }, [deleteRelationship, onRelationshipChange]);

    const handleUpdate = useCallback(async (relationshipId: string, updates: RelationshipInstanceUpdate) => {
        const updated = await updateRelationship(relationshipId, updates);
        if (updated) {
            onRelationshipChange?.();
        }
    }, [updateRelationship, onRelationshipChange]);

    const handleCreate = useCallback(async (
        targetEntityId: string,
        relationshipTypeId: string
    ) => {
        const created = await createRelationship({
            targetEntityId,
            relationshipTypeId,
        });
        if (created) {
            setIsAddDialogOpen(false);
            onRelationshipChange?.();
        }
    }, [createRelationship, onRelationshipChange]);

    const totalCount = groupedRelationships.reduce((sum, g) => sum + g.totalCount, 0);

    return (
        <FactSheetCard
            title="Relationships"
            icon={Network}
            gradient="from-purple-500 to-pink-500"
            actions={
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-white/20 text-white">
                    {totalCount}
                </Badge>
            }
        >
            {isLoading && (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm">Loading relationships...</span>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                </div>
            )}

            {!isLoading && !error && groupedRelationships.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                    No relationships yet
                </div>
            )}

            {/* Grouped Relationships */}
            {groupedRelationships.map((group) => (
                <RelationshipTypeGroup
                    key={group.type.id}
                    group={group}
                    currentEntityId={entity.noteId || `${entity.kind}::${entity.label}`}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    onNavigate={handleNavigateToEntity}
                />
            ))}

            {/* Add Relationship Button */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 mt-2"
                    >
                        <Plus className="h-4 w-4" />
                        Add Relationship
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                    <AddRelationshipDialogContent
                        entity={entity}
                        applicableTypes={applicableTypes}
                        getCandidates={getCandidates}
                        onCreate={handleCreate}
                        onClose={() => setIsAddDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </FactSheetCard>
    );
}

// ==================== SUB-COMPONENTS ====================

interface RelationshipTypeGroupProps {
    group: GroupedRelationships;
    currentEntityId: string;
    onDelete: (id: string) => void;
    onUpdate: (id: string, updates: RelationshipInstanceUpdate) => Promise<void>;
    onNavigate: (entity: { id: string; name: string; kind: EntityKind; noteId?: string }) => void;
}

function RelationshipTypeGroup({ group, currentEntityId, onDelete, onUpdate, onNavigate }: RelationshipTypeGroupProps) {
    const { type, outgoing, incoming } = group;
    const DirectionIcon = type.direction === 'bidirectional' ? ArrowLeftRight : ArrowRight;

    return (
        <div className="border border-border/50 rounded-lg overflow-hidden">
            {/* Type Header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                <DirectionIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-medium flex-1">{type.displayLabel}</span>
                <Badge variant="secondary" className="text-[10px]">
                    {group.totalCount}
                </Badge>
            </div>

            {/* Outgoing */}
            {outgoing.length > 0 && (
                <div className="px-2 py-1 border-t border-border/30">
                    <div className="text-[10px] uppercase text-muted-foreground font-medium px-1 py-0.5">
                        Outgoing
                    </div>
                    {outgoing.map((rel) => (
                        <RelationshipInstanceRow
                            key={rel.id}
                            relationship={rel}
                            displayEntity={rel.targetEntity}
                            onDelete={() => onDelete(rel.id)}
                            onUpdate={(updates) => onUpdate(rel.id, updates)}
                            onNavigate={() => onNavigate(rel.targetEntity)}
                        />
                    ))}
                </div>
            )}

            {/* Incoming */}
            {incoming.length > 0 && (
                <div className="px-2 py-1 border-t border-border/30">
                    <div className="text-[10px] uppercase text-muted-foreground font-medium px-1 py-0.5">
                        Incoming
                    </div>
                    {incoming.map((rel) => (
                        <RelationshipInstanceRow
                            key={rel.id}
                            relationship={rel}
                            displayEntity={rel.sourceEntity}
                            isIncoming
                            onDelete={() => onDelete(rel.id)}
                            onUpdate={(updates) => onUpdate(rel.id, updates)}
                            onNavigate={() => onNavigate(rel.sourceEntity)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

interface RelationshipInstanceRowProps {
    relationship: ResolvedRelationshipInstance;
    displayEntity: { id: string; name: string; kind: EntityKind; noteId?: string };
    isIncoming?: boolean;
    onDelete: () => void;
    onUpdate: (updates: RelationshipInstanceUpdate) => Promise<void>;
    onNavigate: () => void;
}

function RelationshipInstanceRow({
    relationship,
    displayEntity,
    isIncoming,
    onDelete,
    onUpdate,
    onNavigate,
}: RelationshipInstanceRowProps) {
    const EntityIcon = ENTITY_ICONS[displayEntity.kind] || Users;
    const color = ENTITY_COLORS[displayEntity.kind] || '#888';

    return (
        <div className="space-y-0">
            <div className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 group">
                {isIncoming && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground rotate-180" />
                )}
                <EntityIcon className="h-4 w-4 shrink-0" style={{ color }} />

                {/* Clickable entity name - navigates to Fact Sheet */}
                <button
                    onClick={onNavigate}
                    className="text-sm flex-1 truncate text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                    title={`View ${displayEntity.name}'s Fact Sheet`}
                >
                    {displayEntity.name}
                </button>

                {/* Confidence indicator */}
                {relationship.confidence < 1.0 && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0"
                                    style={{
                                        borderColor: relationship.confidence > 0.7 ? '#22c55e' : '#f59e0b',
                                        color: relationship.confidence > 0.7 ? '#22c55e' : '#f59e0b',
                                    }}
                                >
                                    {Math.round(relationship.confidence * 100)}%
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Confidence: {Math.round(relationship.confidence * 100)}%</p>
                                <p className="text-xs text-muted-foreground">
                                    Sources: {relationship.sources.join(', ')}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* Delete button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                >
                    <Trash2 className="h-3 w-3" />
                </Button>

                {!isIncoming && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
            </div>

            {/* Expandable Details Panel */}
            <RelationshipDetailsPanel
                relationship={relationship}
                onUpdate={onUpdate}
            />
        </div>
    );
}

// ==================== ADD DIALOG ====================

interface AddRelationshipDialogContentProps {
    entity: ParsedEntity;
    applicableTypes: ApplicableRelationshipType[];
    getCandidates: (typeId: string) => Promise<CandidateEntity[]>;
    onCreate: (targetEntityId: string, relationshipTypeId: string) => void;
    onClose: () => void;
}

function AddRelationshipDialogContent({
    entity,
    applicableTypes,
    getCandidates,
    onCreate,
    onClose,
}: AddRelationshipDialogContentProps) {
    const [selectedTypeId, setSelectedTypeId] = useState<string>('');
    const [selectedTargetId, setSelectedTargetId] = useState<string>('');
    const [candidates, setCandidates] = useState<CandidateEntity[]>([]);
    const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

    const selectedType = applicableTypes.find(t => t.id === selectedTypeId);

    const handleTypeChange = async (typeId: string) => {
        setSelectedTypeId(typeId);
        setSelectedTargetId('');
        setCandidates([]);

        if (typeId) {
            setIsLoadingCandidates(true);
            try {
                const cands = await getCandidates(typeId);
                setCandidates(cands);
            } catch (err) {
                console.error('Failed to load candidates:', err);
            } finally {
                setIsLoadingCandidates(false);
            }
        }
    };

    const handleCreate = () => {
        if (selectedTypeId && selectedTargetId) {
            onCreate(selectedTargetId, selectedTypeId);
        }
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Add Relationship
                </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
                {/* Source Entity (current) */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">From</label>
                    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                        {(() => {
                            const Icon = ENTITY_ICONS[entity.kind] || Users;
                            const color = ENTITY_COLORS[entity.kind] || '#888';
                            return <Icon className="h-5 w-5" style={{ color }} />;
                        })()}
                        <span className="font-medium">{entity.label}</span>
                        <Badge variant="outline" className="text-[10px]">
                            {entity.kind}
                        </Badge>
                    </div>
                </div>

                {/* Relationship Type */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Relationship</label>
                    <Select value={selectedTypeId} onValueChange={handleTypeChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select relationship type..." />
                        </SelectTrigger>
                        <SelectContent>
                            {applicableTypes.length === 0 && (
                                <div className="py-2 px-3 text-sm text-muted-foreground">
                                    No relationship types available
                                </div>
                            )}
                            {applicableTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                    <div className="flex items-center gap-2">
                                        <span>{type.displayLabel}</span>
                                        <span className="text-muted-foreground">→</span>
                                        <Badge
                                            variant="outline"
                                            className="text-[10px]"
                                            style={{
                                                borderColor: ENTITY_COLORS[type.otherEntityKind] || '#888',
                                                color: ENTITY_COLORS[type.otherEntityKind] || '#888',
                                            }}
                                        >
                                            {type.otherEntityKind}
                                        </Badge>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Target Entity */}
                {selectedTypeId && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">To</label>
                        {isLoadingCandidates ? (
                            <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Loading entities...</span>
                            </div>
                        ) : candidates.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                                No {selectedType?.otherEntityKind} entities found
                            </div>
                        ) : (
                            <ScrollArea className="h-48 border rounded-md">
                                <div className="p-1">
                                    {candidates.map((candidate) => {
                                        const Icon = ENTITY_ICONS[candidate.kind] || Users;
                                        const color = ENTITY_COLORS[candidate.kind] || '#888';
                                        const isSelected = selectedTargetId === candidate.id;

                                        return (
                                            <div
                                                key={candidate.id}
                                                className={cn(
                                                    'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
                                                    isSelected
                                                        ? 'bg-primary/10 border border-primary/30'
                                                        : 'hover:bg-muted/50',
                                                    candidate.hasExistingRelationship && 'opacity-50'
                                                )}
                                                onClick={() => !candidate.hasExistingRelationship && setSelectedTargetId(candidate.id)}
                                            >
                                                <Icon className="h-4 w-4" style={{ color }} />
                                                <span className="flex-1">{candidate.name}</span>
                                                {candidate.hasExistingRelationship && (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        Already linked
                                                    </Badge>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                )}
            </div>

            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                    onClick={handleCreate}
                    disabled={!selectedTypeId || !selectedTargetId}
                >
                    Create Relationship
                </Button>
            </DialogFooter>
        </>
    );
}

export default RelationshipEditorCard;
