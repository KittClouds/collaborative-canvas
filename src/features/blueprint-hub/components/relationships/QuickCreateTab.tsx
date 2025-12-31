import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { EntityKindSelector } from './EntityKindSelector';
import type { RelationshipPreset } from './relationshipPresets';
import type { EntityTypeDef, RelationshipDirection, RelationshipCardinality } from '../../types';
import { ArrowRight, Loader2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface QuickCreateTabProps {
    onCreate: (input: any) => Promise<void>;
    onCancel: () => void;
    initialData?: RelationshipPreset;
    entityTypes: EntityTypeDef[];
}

const DIRECTIONS: { value: RelationshipDirection; label: string }[] = [
    { value: 'directed', label: 'Directed (One-way)' },
    { value: 'bidirectional', label: 'Bidirectional (Two-way)' },
    { value: 'undirected', label: 'Undirected' },
];

const CARDINALITIES: { value: RelationshipCardinality; label: string }[] = [
    { value: 'one_to_one', label: 'One-to-One' },
    { value: 'one_to_many', label: 'One-to-Many' },
    { value: 'many_to_one', label: 'Many-to-One' },
    { value: 'many_to_many', label: 'Many-to-Many' },
];

export function QuickCreateTab({
    onCreate,
    onCancel,
    initialData,
    entityTypes,
}: QuickCreateTabProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        source_entity_kind: '',
        target_entity_kind: '',
        relationship_name: '',
        display_label: '',
        inverse_label: '',
        direction: 'directed' as RelationshipDirection,
        cardinality: 'many_to_many' as RelationshipCardinality,
        description: '',
    });

    // Load initial data if provided
    useEffect(() => {
        if (initialData) {
            setFormData({
                source_entity_kind: initialData.source_entity_kind,
                target_entity_kind: initialData.target_entity_kind,
                relationship_name: initialData.relationship_name,
                display_label: initialData.display_label,
                inverse_label: initialData.inverse_label || '',
                direction: initialData.direction,
                cardinality: initialData.cardinality,
                description: initialData.description || '',
            });
        }
    }, [initialData]);

    // Auto-generate technical name from display label if empty
    const handleLabelChange = (label: string) => {
        const updates: any = { display_label: label };

        // Only auto-generate name if it hasn't been manually edited or is empty
        // Simplified: just update if name is empty or matches previous label transformation
        if (!formData.relationship_name ||
            formData.relationship_name === formData.display_label.toLowerCase().replace(/[^a-z0-9]+/g, '_')) {
            updates.relationship_name = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        }

        setFormData(prev => ({ ...prev, ...updates }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.source_entity_kind || !formData.target_entity_kind || !formData.display_label) return;

        setIsSubmitting(true);
        try {
            await onCreate({
                ...formData,
                is_symmetric: formData.direction === 'undirected' || (formData.direction === 'bidirectional' && !formData.inverse_label),
            });
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Entity Flow */}
                <Card className="p-4 bg-muted/30">
                    <Label className="mb-3 block text-base font-semibold">Entity Connection</Label>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="flex-1 w-full space-y-2">
                            <Label>Source Entity</Label>
                            <EntityKindSelector
                                value={formData.source_entity_kind}
                                onChange={(val) => setFormData(prev => ({ ...prev, source_entity_kind: val }))}
                                placeholder="Select source..."
                            // Z-index fix for dropdowns in this context
                            />
                        </div>

                        <div className="hidden md:flex flex-col items-center justify-center pt-6 text-muted-foreground">
                            {formData.direction === 'bidirectional' ? (
                                <ArrowRight className="w-5 h-5" /> // Should be bidirectional arrow but standard lib might not have it, ArrowRight is fine as placeholder or swap icon
                            ) : (
                                <ArrowRight className="w-5 h-5" />
                            )}
                        </div>

                        <div className="flex-1 w-full space-y-2">
                            <Label>Target Entity</Label>
                            <EntityKindSelector
                                value={formData.target_entity_kind}
                                onChange={(val) => setFormData(prev => ({ ...prev, target_entity_kind: val }))}
                                placeholder="Select target..."
                            />
                        </div>
                    </div>
                </Card>

                {/* Naming */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="display_label">Display Label (Verb)</Label>
                        <Input
                            id="display_label"
                            placeholder="e.g. owns, knows, located at"
                            value={formData.display_label}
                            onChange={(e) => handleLabelChange(e.target.value)}
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            The verb phrase describing the relationship (e.g. "Character <b>owns</b> Item")
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="relationship_name">Technical Name</Label>
                        <Input
                            id="relationship_name"
                            placeholder="e.g. character_owns_item"
                            value={formData.relationship_name}
                            onChange={(e) => setFormData(prev => ({ ...prev, relationship_name: e.target.value }))}
                            className="font-mono text-sm"
                            required
                        />
                    </div>
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label>Direction</Label>
                        <Select
                            value={formData.direction}
                            onValueChange={(val: RelationshipDirection) =>
                                setFormData(prev => ({ ...prev, direction: val }))
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[70]">
                                {DIRECTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Cardinality</Label>
                        <Select
                            value={formData.cardinality}
                            onValueChange={(val: RelationshipCardinality) =>
                                setFormData(prev => ({ ...prev, cardinality: val }))
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[70]">
                                {CARDINALITIES.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="inverse_label">Inverse Label (Optional)</Label>
                        <Input
                            id="inverse_label"
                            placeholder="e.g. owned by"
                            value={formData.inverse_label}
                            onChange={(e) => setFormData(prev => ({ ...prev, inverse_label: e.target.value }))}
                            disabled={formData.direction === 'undirected'}
                        />
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        placeholder="Describe the purpose of this relationship..."
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="h-20"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={
                            isSubmitting ||
                            !formData.source_entity_kind ||
                            !formData.target_entity_kind ||
                            !formData.display_label ||
                            !formData.relationship_name
                        }
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            'Create Relationship Type'
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
