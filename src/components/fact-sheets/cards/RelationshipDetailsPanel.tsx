/**
 * RelationshipDetailsPanel - Expandable details for relationship instances
 * 
 * Shows:
 * - Confidence slider
 * - Temporal bounds (validFrom, validTo)
 * - Provenance info (sources, origin, timestamp)
 * - Custom attributes
 */

import React, { useState, useCallback } from 'react';
import {
    ChevronDown,
    ChevronUp,
    Calendar,
    Percent,
    History,
    Sparkles,
    Save,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { ResolvedRelationshipInstance } from '@/lib/relationships/relationshipBridgeTypes';
import type { RelationshipInstanceUpdate } from '@/lib/relationships/relationshipBridgeTypes';

/** Format source enum value to human-readable label */
function formatSourceLabel(source: string): string {
    const labels: Record<string, string> = {
        'MANUAL': 'Manual',
        'NER_EXTRACTION': 'NER',
        'LLM_EXTRACTION': 'LLM',
        'NETWORK': 'Network',
        'CO_OCCURRENCE': 'Co-occurrence',
        'FOLDER_STRUCTURE': 'Folder',
        'IMPORT': 'Imported',
        'TIMELINE': 'Timeline',
    };
    return labels[source] || source;
}

interface RelationshipDetailsPanelProps {
    relationship: ResolvedRelationshipInstance;
    onUpdate: (updates: RelationshipInstanceUpdate) => Promise<void>;
    isExpanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
}

export function RelationshipDetailsPanel({
    relationship,
    onUpdate,
    isExpanded: controlledExpanded,
    onExpandedChange,
}: RelationshipDetailsPanelProps) {
    const [internalExpanded, setInternalExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Edit state
    const [confidence, setConfidence] = useState(relationship.confidence);
    const [validFrom, setValidFrom] = useState<string>(
        relationship.validFrom ? format(relationship.validFrom, 'yyyy-MM-dd') : ''
    );
    const [validTo, setValidTo] = useState<string>(
        relationship.validTo ? format(relationship.validTo, 'yyyy-MM-dd') : ''
    );

    const isExpanded = controlledExpanded ?? internalExpanded;
    const setExpanded = onExpandedChange ?? setInternalExpanded;

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        try {
            const updates: RelationshipInstanceUpdate = {
                confidence,
                validFrom: validFrom ? new Date(validFrom) : null,
                validTo: validTo ? new Date(validTo) : null,
            };
            await onUpdate(updates);
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to save relationship details:', err);
        } finally {
            setIsSaving(false);
        }
    }, [confidence, validFrom, validTo, onUpdate]);

    const handleCancel = useCallback(() => {
        // Reset to relationship values
        setConfidence(relationship.confidence);
        setValidFrom(relationship.validFrom ? format(relationship.validFrom, 'yyyy-MM-dd') : '');
        setValidTo(relationship.validTo ? format(relationship.validTo, 'yyyy-MM-dd') : '');
        setIsEditing(false);
    }, [relationship]);

    const hasChanges =
        confidence !== relationship.confidence ||
        validFrom !== (relationship.validFrom ? format(relationship.validFrom, 'yyyy-MM-dd') : '') ||
        validTo !== (relationship.validTo ? format(relationship.validTo, 'yyyy-MM-dd') : '');

    return (
        <Collapsible open={isExpanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger asChild>
                <button
                    className={cn(
                        "w-full flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground",
                        "hover:text-foreground hover:bg-muted/50 rounded transition-colors",
                        isExpanded && "bg-muted/30"
                    )}
                >
                    {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                    ) : (
                        <ChevronDown className="h-3 w-3" />
                    )}
                    <span>Details</span>
                    {relationship.sources.length > 1 && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto">
                            {relationship.sources.length} sources
                        </Badge>
                    )}
                </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="px-2 py-2 space-y-3 bg-muted/20 rounded-b-md border-t border-border/30">
                    {/* Confidence */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <Percent className="h-3 w-3 text-muted-foreground" />
                            <Label className="text-xs font-medium">Confidence</Label>
                            <span className="text-xs text-muted-foreground ml-auto">
                                {Math.round(confidence * 100)}%
                            </span>
                        </div>
                        {isEditing ? (
                            <Slider
                                value={[confidence * 100]}
                                onValueChange={([v]) => setConfidence(v / 100)}
                                min={0}
                                max={100}
                                step={5}
                                className="w-full"
                            />
                        ) : (
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all",
                                        confidence > 0.7 ? "bg-green-500" :
                                            confidence > 0.4 ? "bg-yellow-500" : "bg-red-500"
                                    )}
                                    style={{ width: `${confidence * 100}%` }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Temporal Bounds */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <Label className="text-xs font-medium">Temporal Bounds</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">From</Label>
                                {isEditing ? (
                                    <Input
                                        type="date"
                                        value={validFrom}
                                        onChange={(e) => setValidFrom(e.target.value)}
                                        className="h-7 text-xs"
                                    />
                                ) : (
                                    <div className="text-xs text-foreground">
                                        {relationship.validFrom
                                            ? format(relationship.validFrom, 'MMM d, yyyy')
                                            : '—'}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">To</Label>
                                {isEditing ? (
                                    <Input
                                        type="date"
                                        value={validTo}
                                        onChange={(e) => setValidTo(e.target.value)}
                                        className="h-7 text-xs"
                                    />
                                ) : (
                                    <div className="text-xs text-foreground">
                                        {relationship.validTo
                                            ? format(relationship.validTo, 'MMM d, yyyy')
                                            : 'Ongoing'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Provenance */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-3 w-3 text-muted-foreground" />
                            <Label className="text-xs font-medium">Sources</Label>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {relationship.sources.map((source) => {
                                // Convert to string for comparison (handles both enum and string)
                                const sourceStr = String(source);
                                return (
                                    <Badge
                                        key={sourceStr}
                                        variant="secondary"
                                        className={cn(
                                            "text-[10px]",
                                            sourceStr === 'MANUAL' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                            sourceStr.includes('NER') && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                                            sourceStr.includes('LLM') && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                            sourceStr === 'NETWORK' && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                                            sourceStr.includes('CO_OCCURRENCE') && "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
                                            sourceStr.includes('FOLDER') && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                                        )}
                                    >
                                        {formatSourceLabel(sourceStr)}
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>

                    {/* Timestamps */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <History className="h-3 w-3 text-muted-foreground" />
                            <Label className="text-xs font-medium">History</Label>
                        </div>
                        <div className="text-[10px] text-muted-foreground space-y-0.5">
                            <div>Created: {format(relationship.createdAt, 'MMM d, yyyy HH:mm')}</div>
                            <div>Updated: {format(relationship.updatedAt, 'MMM d, yyyy HH:mm')}</div>
                        </div>
                    </div>

                    {/* Custom Attributes */}
                    {Object.keys(relationship.attributes).length > 0 && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Attributes</Label>
                            <div className="text-[10px] font-mono bg-muted/50 rounded p-2 max-h-24 overflow-auto">
                                {JSON.stringify(relationship.attributes, null, 2)}
                            </div>
                        </div>
                    )}

                    {/* Edit Actions */}
                    <div className="flex items-center gap-2 pt-1">
                        {isEditing ? (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1"
                                    onClick={handleCancel}
                                    disabled={isSaving}
                                >
                                    <X className="h-3 w-3" />
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={handleSave}
                                    disabled={!hasChanges || isSaving}
                                >
                                    <Save className="h-3 w-3" />
                                    {isSaving ? 'Saving...' : 'Save'}
                                </Button>
                            </>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => setIsEditing(true)}
                            >
                                Edit Details
                            </Button>
                        )}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

export default RelationshipDetailsPanel;
