import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Trash2, Plus, X, ExternalLink } from 'lucide-react';
import { entityRegistry } from '@/lib/entities/entity-registry';
import { ENTITY_COLORS, type EntityKind } from '@/lib/entities/entityTypes';
import { autoSaveEntityRegistry } from '@/lib/storage/entityStorage';
import { useToast } from '@/hooks/use-toast';
import { useNotes } from '@/contexts/NotesContext'; // For finding note titles

interface EntityDetailModalProps {
    entityId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

export function EntityDetailModal({ entityId, isOpen, onClose, onUpdate }: EntityDetailModalProps) {
    const { toast } = useToast();
    const { state, selectNote } = useNotes();
    const [newAlias, setNewAlias] = useState('');

    if (!entityId) return null;

    const entity = entityRegistry.getEntityById(entityId);
    const stats = entityRegistry.getEntityStats(entityId);

    if (!entity) return null;

    const color = ENTITY_COLORS[entity.kind] || '#6b7280';

    const handleAddAlias = () => {
        if (!newAlias.trim()) return;

        const success = entityRegistry.addAlias(entity.id, newAlias.trim());

        if (success) {
            autoSaveEntityRegistry(entityRegistry);
            setNewAlias('');
            onUpdate();
            toast({ title: 'Alias added' });
        } else {
            toast({
                title: 'Failed to add alias',
                description: 'Alias might already exist or is invalid',
                variant: 'destructive'
            });
        }
    };

    const handleRemoveAlias = (alias: string) => {
        const success = entityRegistry.removeAlias(entity.id, alias);
        if (success) {
            autoSaveEntityRegistry(entityRegistry);
            onUpdate();
            toast({ title: 'Alias removed' });
        }
    };

    const getNoteTitle = (noteId: string) => {
        const note = state.notes.find(n => n.id === noteId);
        return note ? note.title : 'Unknown Note';
    };

    const handleNavigateToNote = (noteId: string) => {
        selectNote(noteId);
        onClose();
    };

    const handleDeleteEntity = () => {
        // Phase 1: No delete UI yet to be safe, but placeholder logic here
        // entityRegistry.deleteEntity(entityId);
        toast({ title: "Delete not implemented yet (Safety)" });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <DialogTitle className="text-xl">{entity.label}</DialogTitle>
                        <Badge
                            style={{ backgroundColor: `${color}20`, color }}
                            variant="outline"
                        >
                            {entity.kind}
                        </Badge>
                        {entity.subtype && (
                            <Badge variant="secondary" className="text-xs">
                                {entity.subtype}
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4 -mr-4">
                    <div className="space-y-6 py-4">
                        {/* Statistics */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/50 p-3 rounded-lg border text-center">
                                <div className="text-2xl font-bold">{stats?.totalMentions || 0}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Mentions</div>
                            </div>
                            <div className="bg-muted/50 p-3 rounded-lg border text-center">
                                <div className="text-2xl font-bold">{stats?.noteCount || 0}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">Notes</div>
                            </div>
                        </div>

                        {/* Aliases */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium text-muted-foreground">Aliases</Label>
                            <div className="flex flex-wrap gap-2">
                                {entity.aliases?.map(alias => (
                                    <Badge key={alias} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 group">
                                        {alias}
                                        <button
                                            onClick={() => handleRemoveAlias(alias)}
                                            className="h-4 w-4 hover:bg-destructive/10 hover:text-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    value={newAlias}
                                    onChange={(e) => setNewAlias(e.target.value)}
                                    placeholder="Add alias..."
                                    className="h-8 text-sm"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
                                />
                                <Button size="sm" variant="outline" onClick={handleAddAlias} className="h-8">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Appearances */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium text-muted-foreground">Appears In</Label>
                            <div className="grid gap-1">
                                {Array.from(entity.noteAppearances).slice(0, 10).map(noteId => (
                                    <button
                                        key={noteId}
                                        onClick={() => handleNavigateToNote(noteId)}
                                        className="text-sm text-left hover:underline flex items-center gap-2 py-1 px-2 rounded hover:bg-accent"
                                    >
                                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                        <span className='truncate'>{getNoteTitle(noteId)}</span>
                                    </button>
                                ))}
                                {entity.noteAppearances.size > 10 && (
                                    <div className="text-xs text-muted-foreground px-2">
                                        + {entity.noteAppearances.size - 10} more notes...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
