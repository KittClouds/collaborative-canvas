import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { ENTITY_KINDS, ENTITY_SUBTYPES, type EntityKind } from '@/lib/entities/entityTypes';
import { entityRegistry } from '@/lib/entities/entity-registry';
import { autoSaveEntityRegistry } from '@/lib/storage/entityStorage';
import { useToast } from '@/hooks/use-toast';
import { useNotes } from '@/contexts/NotesContext';

interface EntityCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEntityCreated?: () => void;
}

export function EntityCreationModal({ isOpen, onClose, onEntityCreated }: EntityCreationModalProps) {
    const { toast } = useToast();
    const { selectedNote } = useNotes();

    const [label, setLabel] = useState('');
    const [kind, setKind] = useState<EntityKind>('CHARACTER');
    const [subtype, setSubtype] = useState('');
    const [aliases, setAliases] = useState('');

    const handleCreate = () => {
        if (!label.trim()) return;

        try {
            // Split aliases by comma
            const aliasList = aliases
                .split(',')
                .map(a => a.trim())
                .filter(a => a.length > 0);

            const entity = entityRegistry.registerEntity(
                label.trim(),
                kind,
                selectedNote?.id || 'manual_creation', // Fallback if no note selected
                {
                    subtype: subtype || undefined,
                    aliases: aliasList,
                }
            );

            // Persist immediately
            autoSaveEntityRegistry(entityRegistry);

            toast({
                title: 'Entity Created',
                description: `${entity.label} registered as ${entity.kind}`,
            });

            // Cleanup
            setLabel('');
            setSubtype('');
            setAliases('');
            onEntityCreated?.();
            onClose();
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to create entity',
                variant: 'destructive',
            });
        }
    };

    const availableSubtypes = ENTITY_SUBTYPES[kind] || [];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Entity</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="label">Label (Name)</Label>
                        <Input
                            id="label"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="e.g. Jillybean"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Kind</Label>
                            <Select
                                value={kind}
                                onValueChange={(val) => {
                                    setKind(val as EntityKind);
                                    setSubtype(''); // Reset subtype when kind changes
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select kind" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ENTITY_KINDS.map((k) => (
                                        <SelectItem key={k} value={k}>
                                            {k}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Subtype (Optional)</Label>
                            <Select
                                value={subtype}
                                onValueChange={setSubtype}
                                disabled={availableSubtypes.length === 0}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select subtype" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableSubtypes.map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="aliases">Aliases (comma separated)</Label>
                        <Input
                            id="aliases"
                            value={aliases}
                            onChange={(e) => setAliases(e.target.value)}
                            placeholder="e.g. Jilly, JB, The Hero"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={!label.trim()}>
                        Create Entity
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
