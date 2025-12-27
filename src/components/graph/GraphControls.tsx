import React from 'react';
import { ProjectionScope } from '../../lib/graph/projections/types';
import { FilterState } from '../../hooks/useGraphFilters';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { Slider } from "../ui/slider";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Separator } from '../ui/separator';

interface GraphControlsProps {
    scope: ProjectionScope;
    setScope: (scope: ProjectionScope) => void;
    filters: FilterState;
    setFilters: (f: FilterState | ((prev: FilterState) => FilterState)) => void;
    className?: string;
}

export default function GraphControls({
    scope,
    setScope,
    filters,
    setFilters,
    className
}: GraphControlsProps) {

    // Handlers for scope change
    const handleTypeChange = (value: string) => {
        let newScope: ProjectionScope;

        if (value === 'obsidian') {
            newScope = { type: 'obsidian', target: 'global' };
        } else if (value === 'entity') {
            newScope = { type: 'entity', target: 'global' };
        } else {
            // concept - requires contextId usually, but we set dummy for now or global if supported?
            // Plan didn't explicitly support 'global' concept scope, but let's default to global
            // or force user to pick context. 
            // For now, let's just default to obsidian if invalid, or a default note?
            // Ideally we shouldn't switch to invalid state. 
            // Let's assume concept target is 'note' and we pick a stored noteId or wait for user.
            newScope = { type: 'concept', target: 'note', contextId: 'temp-context' };
        }
        setScope(newScope);
    };

    const handleTargetChange = (value: string) => {
        // Logic to switch target within current type
        // Simplified for now
        if (scope.type === 'obsidian') {
            if (value === 'folder') {
                // needs folderId
                setScope({ ...scope, target: 'folder', folderId: 'root' });
            } else {
                setScope({ type: 'obsidian', target: 'global' });
            }
        } else if (scope.type === 'entity') {
            if (value === 'note') {
                setScope({ ...scope, target: 'note', contextId: 'current-note' });
            } else {
                setScope({ type: 'entity', target: 'global' });
            }
        }
    };

    return (
        <div className={className}>
            <div className="bg-background/95 backdrop-blur border-t p-4 flex flex-col gap-4">

                {/* Scope Selector Row */}
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex flex-col gap-1.5 w-40">
                        <Label className="text-xs text-muted-foreground">Graph Type</Label>
                        <Select value={scope.type} onValueChange={handleTypeChange}>
                            <SelectTrigger className="h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="obsidian">Notes Links</SelectItem>
                                <SelectItem value="entity">Knowledge Graph</SelectItem>
                                <SelectItem value="concept">Concept/Terms</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5 w-40">
                        <Label className="text-xs text-muted-foreground">Scope</Label>
                        <Select value={scope.target} onValueChange={handleTargetChange}>
                            <SelectTrigger className="h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="global">Global (Vault)</SelectItem>
                                <SelectItem value="folder">Folder</SelectItem>
                                <SelectItem value="note">Single Note</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator orientation="vertical" className="h-8" />

                    {/* Filter Controls */}
                    <div className="flex flex-col gap-1.5 w-60">
                        <div className="flex justify-between">
                            <Label className="text-xs text-muted-foreground">Min Weight</Label>
                            <span className="text-xs font-mono">{filters.minWeight}</span>
                        </div>
                        <Slider
                            value={[filters.minWeight]}
                            max={10}
                            step={1}
                            onValueChange={(v) => setFilters(prev => ({ ...prev, minWeight: v[0] }))}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}
