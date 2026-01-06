/**
 * WikiStoryBeats Component
 * Kanban-style beat sheet for story structure.
 * Phase 2C: Entity-scoped view - shows character-specific beats when entity is focused.
 * 
 * No persistence yet - UI only with sample data.
 */
import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import {
    Clapperboard,
    Plus,
    MoreVertical,
    GripVertical,
    User
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { hasEntityFocusAtom, focusedEntityLabelAtom, focusedEntityIdAtom } from '@/atoms/narrative-focus';

interface Beat {
    id: string;
    title: string;
    description: string;
    beatType: string;
    status: 'planned' | 'draft' | 'complete';
    entityId?: string; // Optional - when assigned to a specific entity
}

interface Act {
    id: string;
    name: string;
    color: string;
    beats: Beat[];
}

const SAMPLE_ACTS: Act[] = [
    {
        id: 'act1',
        name: 'Act 1',
        color: '#3b82f6',
        beats: [
            { id: '1', title: 'Beat 1', description: 'Opening image - establish the world before the story begins.', beatType: 'Opening Image', status: 'planned' },
            { id: '2', title: 'Beat 2', description: 'Theme stated - hint at the story\'s deeper meaning.', beatType: 'Theme Stated', status: 'planned' },
            { id: '3', title: 'Beat 3', description: 'Set-up - introduce the hero and their ordinary world.', beatType: 'Set-Up', status: 'planned' },
        ]
    },
    {
        id: 'act2',
        name: 'Act 2',
        color: '#f59e0b',
        beats: [
            { id: '4', title: 'Beat 7', description: 'B-Story develops - relationships that carry the theme.', beatType: 'B-Story', status: 'planned' },
            { id: '5', title: 'Beat 8', description: 'Fun and Games - the promise of the premise.', beatType: 'Fun and Games', status: 'planned' },
        ]
    },
    {
        id: 'act3',
        name: 'Act 3',
        color: '#ef4444',
        beats: [
            { id: '6', title: 'Beat 13', description: 'Break into Act 3 - the hero commits to the final push.', beatType: 'Break Into Act 3', status: 'planned' },
            { id: '7', title: 'Beat 14', description: 'Final Battle/Climax - the ultimate confrontation.', beatType: 'Final Battle', status: 'planned' },
        ]
    },
];

const BEAT_TYPE_COLORS: Record<string, string> = {
    'Opening Image': '#3b82f6',
    'Theme Stated': '#8b5cf6',
    'Set-Up': '#10b981',
    'B-Story': '#f59e0b',
    'Fun and Games': '#ec4899',
    'Break Into Act 3': '#ef4444',
    'Final Battle': '#dc2626',
};

const STATUS_STYLES = {
    'planned': 'bg-muted text-muted-foreground',
    'draft': 'bg-amber-500/20 text-amber-500',
    'complete': 'bg-green-500/20 text-green-500',
};

interface BeatCardProps {
    beat: Beat;
}

function BeatCard({ beat }: BeatCardProps) {
    const typeColor = BEAT_TYPE_COLORS[beat.beatType] || '#666';

    return (
        <div className="group p-3 rounded-lg border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-start gap-2 mb-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <Badge
                        className="text-[9px] px-1.5 py-0 h-4 mb-1.5"
                        style={{ backgroundColor: `${typeColor}20`, color: typeColor }}
                    >
                        {beat.beatType}
                    </Badge>
                    <h4 className="font-medium text-sm text-foreground">{beat.title}</h4>
                </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3 ml-6">
                {beat.description}
            </p>
            <div className="flex items-center justify-between mt-3 ml-6">
                <Badge className={cn("text-[9px] px-1.5 py-0", STATUS_STYLES[beat.status])}>
                    {beat.status.charAt(0).toUpperCase() + beat.status.slice(1)}
                </Badge>
            </div>
        </div>
    );
}

interface ActColumnProps {
    act: Act;
    onAddBeat: () => void;
}

function ActColumn({ act, onAddBeat }: ActColumnProps) {
    return (
        <div className="w-80 shrink-0 flex flex-col">
            {/* Column Header */}
            <div
                className="flex items-center justify-between px-3 py-2 rounded-t-lg"
                style={{ backgroundColor: `${act.color}15` }}
            >
                <div className="flex items-center gap-2">
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: act.color }}
                    />
                    <span className="font-semibold text-sm">{act.name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {act.beats.length}
                    </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreVertical className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 bg-muted/20 rounded-b-lg border border-t-0 border-border">
                {act.beats.map(beat => (
                    <BeatCard key={beat.id} beat={beat} />
                ))}

                {/* Add Beat Button */}
                <Button
                    variant="ghost"
                    className="w-full h-8 text-xs text-muted-foreground gap-1"
                    onClick={onAddBeat}
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add beat
                </Button>
            </div>
        </div>
    );
}

export function WikiStoryBeats() {
    const [acts] = useState(SAMPLE_ACTS);

    // Entity scope awareness
    const hasEntityFocus = useAtomValue(hasEntityFocusAtom);
    const focusedEntityLabel = useAtomValue(focusedEntityLabelAtom);

    const handleAddBeat = () => {
        toast.info('Coming Soon', {
            description: 'Beat creation will be available once data models are finalized.',
        });
    };

    const handleAddAct = () => {
        toast.info('Coming Soon', {
            description: 'Act creation will be available once data models are finalized.',
        });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="relative h-32 shrink-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-900 via-slate-900 to-slate-800" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-end gap-4">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                <Clapperboard className="h-5 w-5 text-orange-500" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-foreground">Story Beats</h1>
                                <p className="text-sm text-muted-foreground">
                                    {hasEntityFocus
                                        ? `${focusedEntityLabel}'s story arc`
                                        : 'Plan your narrative structure'
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {hasEntityFocus && (
                                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-orange-500/50 text-orange-400">
                                    <User className="h-3.5 w-3.5" />
                                    {focusedEntityLabel}
                                </Badge>
                            )}
                            <Button className="gap-2 bg-orange-600 hover:bg-orange-700" onClick={handleAddAct}>
                                <Plus className="h-4 w-4" />
                                Add Act
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scope Banner */}
            {hasEntityFocus && (
                <div className="px-6 py-3 bg-orange-500/10 border-b border-orange-500/20 flex items-center gap-3">
                    <span className="text-sm text-orange-400">
                        Viewing beats for <strong>{focusedEntityLabel}</strong>
                    </span>
                    <span className="text-xs text-muted-foreground">
                        • Clear entity focus to see all story beats
                    </span>
                </div>
            )}

            {/* Kanban Board */}
            <ScrollArea className="flex-1">
                <div className="p-6">
                    <div className="flex gap-4 pb-4">
                        {acts.map(act => (
                            <ActColumn key={act.id} act={act} onAddBeat={handleAddBeat} />
                        ))}
                    </div>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}

export default WikiStoryBeats;
