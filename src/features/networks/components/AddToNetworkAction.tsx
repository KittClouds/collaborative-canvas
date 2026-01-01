/**
 * AddToNetworkAction - Dialog for manually adding a relationship to a network
 * 
 * Used in Fact Sheets and relationship context menus to let users
 * manually associate relationships with networks.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Network,
    Plus,
    Check,
    Loader2,
    Users,
    Building,
    Flag,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { EntityKind } from '@/lib/types/entityTypes';
import type {
    NetworkInstance,
    NetworkSchema,
    NetworkRelationshipDef,
} from '@/lib/networks/types';
import { NETWORK_COLORS } from '@/lib/networks/types';
import {
    getAvailableNetworksForRelationship,
    addRelationshipToNetwork,
} from '@/lib/networks/autoMembership';

interface AddToNetworkActionProps {
    /** Source entity info */
    sourceEntity: {
        id: string;
        name: string;
        kind: EntityKind;
    };
    /** Target entity info */
    targetEntity: {
        id: string;
        name: string;
        kind: EntityKind;
    };
    /** Trigger button content (optional) */
    trigger?: React.ReactNode;
    /** Callback when relationship is added to a network */
    onAdded?: (networkId: string) => void;
}

interface AvailableNetwork {
    network: NetworkInstance;
    schema: NetworkSchema;
    availableRelationships: NetworkRelationshipDef[];
    alreadyMember: boolean;
}

export function AddToNetworkAction({
    sourceEntity,
    targetEntity,
    trigger,
    onAdded,
}: AddToNetworkActionProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [availableNetworks, setAvailableNetworks] = useState<AvailableNetwork[]>([]);
    const [selectedNetworkId, setSelectedNetworkId] = useState<string>('');
    const [selectedRelationshipCode, setSelectedRelationshipCode] = useState<string>('');

    // Load available networks when dialog opens
    useEffect(() => {
        if (!open) return;

        async function loadNetworks() {
            setLoading(true);
            try {
                const networks = await getAvailableNetworksForRelationship(
                    sourceEntity.id,
                    targetEntity.id,
                    sourceEntity.kind,
                    targetEntity.kind
                );
                setAvailableNetworks(networks);

                // Auto-select first non-member network
                const firstAvailable = networks.find(n => !n.alreadyMember);
                if (firstAvailable) {
                    setSelectedNetworkId(firstAvailable.network.id);
                    if (firstAvailable.availableRelationships.length > 0) {
                        setSelectedRelationshipCode(firstAvailable.availableRelationships[0].code);
                    }
                }
            } catch (err) {
                console.error('Failed to load networks:', err);
                toast({
                    title: 'Error',
                    description: 'Failed to load available networks',
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        }

        loadNetworks();
    }, [open, sourceEntity.id, targetEntity.id, sourceEntity.kind, targetEntity.kind]);

    // Get selected network and its relationships
    const selectedNetwork = availableNetworks.find(n => n.network.id === selectedNetworkId);
    const availableRelationships = selectedNetwork?.availableRelationships ?? [];

    const handleSubmit = async () => {
        if (!selectedNetworkId || !selectedRelationshipCode) return;

        setSubmitting(true);
        try {
            const result = await addRelationshipToNetwork({
                sourceEntityId: sourceEntity.id,
                targetEntityId: targetEntity.id,
                networkId: selectedNetworkId,
                relationshipCode: selectedRelationshipCode,
            });

            if (result) {
                toast({
                    title: 'Added to network',
                    description: `Relationship added to ${selectedNetwork?.network.name}`,
                });
                onAdded?.(selectedNetworkId);
                setOpen(false);
            } else {
                throw new Error('Failed to add to network');
            }
        } catch (err) {
            console.error('Failed to add to network:', err);
            toast({
                title: 'Error',
                description: 'Failed to add relationship to network',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {trigger ? (
                <div onClick={() => setOpen(true)}>{trigger}</div>
            ) : (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(true)}
                    className="gap-1.5"
                >
                    <Network className="h-3.5 w-3.5" />
                    Add to Network
                </Button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md z-[70]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Network className="h-5 w-5 text-primary" />
                            Add to Network
                        </DialogTitle>
                        <DialogDescription>
                            Add the relationship between{' '}
                            <span className="font-medium">{sourceEntity.name}</span> and{' '}
                            <span className="font-medium">{targetEntity.name}</span> to a network.
                        </DialogDescription>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : availableNetworks.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                            <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No compatible networks found.</p>
                            <p className="text-sm mt-1">
                                Create a network that supports {sourceEntity.kind} and {targetEntity.kind} entities.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            {/* Network Selection */}
                            <div className="space-y-2">
                                <Label>Network</Label>
                                <Select
                                    value={selectedNetworkId}
                                    onValueChange={(value) => {
                                        setSelectedNetworkId(value);
                                        // Reset relationship selection
                                        const network = availableNetworks.find(n => n.network.id === value);
                                        if (network?.availableRelationships.length) {
                                            setSelectedRelationshipCode(network.availableRelationships[0].code);
                                        } else {
                                            setSelectedRelationshipCode('');
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a network" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[80]">
                                        {availableNetworks.map(({ network, schema, alreadyMember }) => (
                                            <SelectItem
                                                key={network.id}
                                                value={network.id}
                                                disabled={alreadyMember}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="h-2 w-2 rounded-full"
                                                        style={{ backgroundColor: schema.color || NETWORK_COLORS[schema.kind] }}
                                                    />
                                                    <span>{network.name}</span>
                                                    {alreadyMember && (
                                                        <Badge variant="secondary" className="text-[9px] ml-1">
                                                            <Check className="h-3 w-3 mr-0.5" />
                                                            Added
                                                        </Badge>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Relationship Type Selection */}
                            {selectedNetwork && availableRelationships.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Relationship Type</Label>
                                    <Select
                                        value={selectedRelationshipCode}
                                        onValueChange={setSelectedRelationshipCode}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select relationship type" />
                                        </SelectTrigger>
                                        <SelectContent className="z-[80]">
                                            {availableRelationships.map((relDef) => (
                                                <SelectItem key={relDef.code} value={relDef.code}>
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="h-2 w-2 rounded-full"
                                                            style={{ backgroundColor: relDef.color || '#9333ea' }}
                                                        />
                                                        <span>{relDef.label}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedRelationshipCode && (
                                        <p className="text-xs text-muted-foreground">
                                            {availableRelationships.find(r => r.code === selectedRelationshipCode)?.description}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!selectedNetworkId || !selectedRelationshipCode || submitting}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add to Network
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default AddToNetworkAction;
