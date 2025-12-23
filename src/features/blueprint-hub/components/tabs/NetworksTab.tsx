/**
 * Networks Tab for Blueprint Hub
 * 
 * Displays all network instances with management capabilities:
 * - View all networks (Family Trees, Organizations, etc.)
 * - View/edit network members and relationships
 * - Schema preview and validation status
 * - Quick actions for network management
 */

import { useState, useEffect, useMemo } from 'react';
import {
    Network,
    Users,
    Building,
    Flag,
    Handshake,
    Hammer,
    Heart,
    Swords,
    Wrench,
    ChevronRight,
    ChevronDown,
    Edit,
    Trash2,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    Folder,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { useAllNetworks } from '@/hooks/useNetwork';
import type { NetworkInstance, NetworkKind, NetworkSchema, NetworkRelationshipInstance } from '@/lib/networks/types';
import { NETWORK_COLORS } from '@/lib/networks/types';
import { getSchemaById, BUILTIN_SCHEMAS } from '@/lib/networks/schemas';
import { loadNetworkRelationships, deleteNetworkInstance, updateNetworkInstance } from '@/lib/networks/storage';
import { networkValidator } from '@/lib/networks/validator';

/**
 * Icon mapping for network kinds
 */
const NETWORK_ICONS: Record<NetworkKind, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    FAMILY: Users,
    ORGANIZATION: Building,
    FACTION: Flag,
    ALLIANCE: Handshake,
    GUILD: Hammer,
    FRIENDSHIP: Heart,
    RIVALRY: Swords,
    CUSTOM: Wrench,
};

interface NetworksTabProps {
    isLoading?: boolean;
}

export function NetworksTab({ isLoading }: NetworksTabProps) {
    const { networks, isLoading: networksLoading, refresh } = useAllNetworks();
    const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set());
    const [selectedNetwork, setSelectedNetwork] = useState<NetworkInstance | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [networkToDelete, setNetworkToDelete] = useState<NetworkInstance | null>(null);

    const loading = isLoading || networksLoading;

    // Group networks by kind
    const groupedNetworks = useMemo(() => {
        const groups: Record<NetworkKind, NetworkInstance[]> = {
            FAMILY: [],
            ORGANIZATION: [],
            FACTION: [],
            ALLIANCE: [],
            GUILD: [],
            FRIENDSHIP: [],
            RIVALRY: [],
            CUSTOM: [],
        };

        for (const network of networks) {
            const schema = getSchemaById(network.schemaId);
            const kind = schema?.kind || 'CUSTOM';
            groups[kind].push(network);
        }

        return groups;
    }, [networks]);

    const toggleExpanded = (networkId: string) => {
        setExpandedNetworks(prev => {
            const next = new Set(prev);
            if (next.has(networkId)) {
                next.delete(networkId);
            } else {
                next.add(networkId);
            }
            return next;
        });
    };

    const handleDelete = async () => {
        if (!networkToDelete) return;

        try {
            await deleteNetworkInstance(networkToDelete.id);
            toast({
                title: 'Network deleted',
                description: `"${networkToDelete.name}" has been deleted.`,
            });
            refresh();
        } catch (error) {
            toast({
                title: 'Delete failed',
                description: 'Failed to delete network.',
                variant: 'destructive',
            });
        } finally {
            setNetworkToDelete(null);
            setDeleteDialogOpen(false);
        }
    };

    const handleRefresh = () => {
        refresh();
        toast({
            title: 'Refreshed',
            description: 'Network list has been refreshed.',
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const totalNetworks = networks.length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Network className="h-5 w-5" />
                        Networks
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Manage relationship networks like family trees and org charts
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefresh}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-2xl">{totalNetworks}</CardTitle>
                        <CardDescription>Total Networks</CardDescription>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-2xl">{groupedNetworks.FAMILY.length}</CardTitle>
                        <CardDescription className="flex items-center gap-1">
                            <Users className="h-3 w-3" style={{ color: NETWORK_COLORS.FAMILY }} />
                            Family Trees
                        </CardDescription>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-2xl">{groupedNetworks.ORGANIZATION.length}</CardTitle>
                        <CardDescription className="flex items-center gap-1">
                            <Building className="h-3 w-3" style={{ color: NETWORK_COLORS.ORGANIZATION }} />
                            Organizations
                        </CardDescription>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-2xl">
                            {groupedNetworks.FACTION.length + groupedNetworks.ALLIANCE.length + groupedNetworks.GUILD.length}
                        </CardTitle>
                        <CardDescription>Other Networks</CardDescription>
                    </CardHeader>
                </Card>
            </div>

            {/* Networks List */}
            {totalNetworks === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Network className="h-12 w-12 text-muted-foreground mb-4" />
                        <h4 className="font-semibold mb-2">No Networks Yet</h4>
                        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                            Create your first network by clicking the network icon in the sidebar's Files section header.
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Look for the</span>
                            <Network className="h-4 w-4" />
                            <span>icon next to</span>
                            <Folder className="h-4 w-4" />
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <ScrollArea className="h-[400px]">
                    <div className="space-y-6">
                        {(Object.entries(groupedNetworks) as [NetworkKind, NetworkInstance[]][])
                            .filter(([, nets]) => nets.length > 0)
                            .map(([kind, nets]) => {
                                const Icon = NETWORK_ICONS[kind];
                                const color = NETWORK_COLORS[kind];

                                return (
                                    <div key={kind}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Icon className="h-4 w-4" style={{ color }} />
                                            <h4 className="font-medium text-sm">{kind.replace('_', ' ')}</h4>
                                            <Badge variant="secondary" className="text-xs">
                                                {nets.length}
                                            </Badge>
                                        </div>

                                        <div className="space-y-2">
                                            {nets.map(network => (
                                                <NetworkCard
                                                    key={network.id}
                                                    network={network}
                                                    isExpanded={expandedNetworks.has(network.id)}
                                                    onToggleExpand={() => toggleExpanded(network.id)}
                                                    onEdit={() => {
                                                        setSelectedNetwork(network);
                                                        setEditDialogOpen(true);
                                                    }}
                                                    onDelete={() => {
                                                        setNetworkToDelete(network);
                                                        setDeleteDialogOpen(true);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </ScrollArea>
            )}

            {/* Edit Dialog */}
            <NetworkEditDialog
                network={selectedNetwork}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={async (updates) => {
                    if (!selectedNetwork) return;
                    await updateNetworkInstance(selectedNetwork.id, updates);
                    refresh();
                    setEditDialogOpen(false);
                    toast({
                        title: 'Network updated',
                        description: 'Changes have been saved.',
                    });
                }}
            />

            {/* Delete Confirmation */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Network</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{networkToDelete?.name}"?
                            This will remove all relationships but keep the member entities.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ===== NETWORK CARD COMPONENT =====

interface NetworkCardProps {
    network: NetworkInstance;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

function NetworkCard({
    network,
    isExpanded,
    onToggleExpand,
    onEdit,
    onDelete,
}: NetworkCardProps) {
    const [relationships, setRelationships] = useState<NetworkRelationshipInstance[]>([]);
    const [validationResult, setValidationResult] = useState<{ valid: boolean; errorCount: number } | null>(null);
    const schema = getSchemaById(network.schemaId);
    const kind = schema?.kind || 'CUSTOM';
    const Icon = NETWORK_ICONS[kind];
    const color = NETWORK_COLORS[kind];

    // Load relationships when expanded
    useEffect(() => {
        if (isExpanded) {
            loadNetworkRelationships(network.id).then(setRelationships);

            // Validate
            if (schema) {
                networkValidator.validateNetwork(network, schema).then(result => {
                    setValidationResult({
                        valid: result.valid,
                        errorCount: result.errors.length,
                    });
                });
            }
        }
    }, [isExpanded, network.id, network, schema]);

    // Group relationships by type
    const relationshipsByType = useMemo(() => {
        const grouped: Record<string, number> = {};
        for (const rel of relationships) {
            grouped[rel.relationshipCode] = (grouped[rel.relationshipCode] || 0) + 1;
        }
        return grouped;
    }, [relationships]);

    return (
        <Card className="border">
            <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
                <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <Button variant="ghost" size="icon" className="h-6 w-6 p-0 shrink-0">
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </Button>

                        <Icon className="h-5 w-5 shrink-0" style={{ color }} />

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{network.name}</span>
                                <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                    style={{
                                        backgroundColor: `${color}20`,
                                        color: color,
                                    }}
                                >
                                    {kind}
                                </Badge>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">
                                {network.entityIds.length} members
                            </span>
                            {validationResult && (
                                validationResult.valid ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                )
                            )}
                        </div>
                    </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <Separator />
                    <div className="p-4 space-y-4 bg-muted/20">
                        {/* Description */}
                        {network.description && (
                            <p className="text-sm text-muted-foreground">{network.description}</p>
                        )}

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Members</p>
                                <p className="font-medium">{network.entityIds.length}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Relationships</p>
                                <p className="font-medium">{relationships.length}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Schema</p>
                                <p className="font-medium">{schema?.name || 'Custom'}</p>
                            </div>
                        </div>

                        {/* Relationship Types */}
                        {Object.keys(relationshipsByType).length > 0 && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-2">Relationship Types</p>
                                <div className="flex flex-wrap gap-1">
                                    {Object.entries(relationshipsByType).map(([code, count]) => (
                                        <Badge key={code} variant="outline" className="text-xs">
                                            {code}: {count}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Validation */}
                        {validationResult && !validationResult.valid && (
                            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                                <AlertCircle className="h-4 w-4" />
                                {validationResult.errorCount} validation issue(s)
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2">
                            <Button variant="outline" size="sm" onClick={onEdit}>
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={onDelete}
                            >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                            </Button>
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}

// ===== EDIT DIALOG =====

interface NetworkEditDialogProps {
    network: NetworkInstance | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updates: Partial<NetworkInstance>) => Promise<void>;
}

function NetworkEditDialog({ network, open, onOpenChange, onSave }: NetworkEditDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (network) {
            setName(network.name);
            setDescription(network.description || '');
        }
    }, [network]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({ name, description });
        } finally {
            setIsSaving(false);
        }
    };

    if (!network) return null;

    const schema = getSchemaById(network.schemaId);
    const kind = schema?.kind || 'CUSTOM';
    const Icon = NETWORK_ICONS[kind];
    const color = NETWORK_COLORS[kind];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Icon className="h-5 w-5" style={{ color }} />
                        Edit Network
                    </DialogTitle>
                    <DialogDescription>
                        Update network details
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">Name</Label>
                        <Input
                            id="edit-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Network name"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-description">Description</Label>
                        <Textarea
                            id="edit-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description..."
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Schema</Label>
                        <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline">{schema?.name || 'Custom'}</Badge>
                            <span className="text-muted-foreground">
                                {schema?.relationships.length || 0} relationship types
                            </span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default NetworksTab;
