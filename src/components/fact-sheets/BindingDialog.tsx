/**
 * Binding Dialog
 * 
 * Dialog for creating and editing field bindings.
 * Allows users to select target entity/field and configure binding options.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
    ArrowRight, ArrowLeftRight, Sigma, Link, Search, X,
    ChevronDown, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
    createBindingAtom,
    updateBindingAtom,
    deleteBindingAtom,
    wouldCreateCycleAtom,
    getAvailableTransforms,
    getAvailableAggregations,
    getAggregationDescription,
} from '@/lib/bindings';
import type {
    FieldBinding,
    BindingType,
    TransformType,
    AggregationFunction,
    CreateBindingOptions,
} from '@/lib/bindings';
import type { ParsedEntity } from '@/types/factSheetTypes';

// ============================================
// BINDING TYPE SELECTOR
// ============================================

interface BindingTypeSelectorProps {
    value: BindingType;
    onChange: (type: BindingType) => void;
}

const bindingTypeInfo: Record<BindingType, { icon: typeof ArrowRight; label: string; description: string }> = {
    inherit: {
        icon: ArrowRight,
        label: 'Inherit',
        description: 'One-way sync from target to this field',
    },
    mirror: {
        icon: ArrowLeftRight,
        label: 'Mirror',
        description: 'Two-way sync between fields',
    },
    aggregate: {
        icon: Sigma,
        label: 'Aggregate',
        description: 'Combine values from multiple entities',
    },
};

function BindingTypeSelector({ value, onChange }: BindingTypeSelectorProps) {
    return (
        <div className="grid grid-cols-3 gap-2">
            {(Object.entries(bindingTypeInfo) as [BindingType, typeof bindingTypeInfo.inherit][]).map(
                ([type, info]) => {
                    const Icon = info.icon;
                    const isSelected = value === type;

                    return (
                        <button
                            key={type}
                            type="button"
                            onClick={() => onChange(type)}
                            className={cn(
                                'flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors',
                                'hover:bg-muted',
                                isSelected
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border/50 text-muted-foreground'
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="text-sm font-medium">{info.label}</span>
                        </button>
                    );
                }
            )}
        </div>
    );
}

// ============================================
// ENTITY/FIELD PICKER
// ============================================

interface EntityFieldPickerProps {
    entities: ParsedEntity[];
    selectedEntityId: string;
    selectedFieldName: string;
    onEntityChange: (entityId: string) => void;
    onFieldChange: (fieldName: string) => void;
    excludeEntityId?: string;
    excludeFieldName?: string;
}

function EntityFieldPicker({
    entities,
    selectedEntityId,
    selectedFieldName,
    onEntityChange,
    onFieldChange,
    excludeEntityId,
    excludeFieldName,
}: EntityFieldPickerProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredEntities = useMemo(() => {
        return entities
            .filter(e => e.noteId !== excludeEntityId || e.label !== excludeFieldName)
            .filter(e =>
                e.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                e.kind.toLowerCase().includes(searchTerm.toLowerCase())
            );
    }, [entities, searchTerm, excludeEntityId, excludeFieldName]);

    const selectedEntity = entities.find(e => e.noteId === selectedEntityId);
    const availableFields = selectedEntity
        ? Object.keys(selectedEntity.attributes || {})
        : [];

    return (
        <div className="space-y-3">
            {/* Entity Search */}
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search entities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Entity List */}
            <ScrollArea className="h-40 rounded-md border border-border/50">
                <div className="p-2 space-y-1">
                    {filteredEntities.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-4">
                            No entities found
                        </div>
                    ) : (
                        filteredEntities.map((entity) => (
                            <button
                                key={entity.noteId || entity.label}
                                type="button"
                                onClick={() => onEntityChange(entity.noteId || entity.label)}
                                className={cn(
                                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                                    'hover:bg-muted',
                                    selectedEntityId === (entity.noteId || entity.label)
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-foreground'
                                )}
                            >
                                <div className="font-medium">{entity.label}</div>
                                <div className="text-xs text-muted-foreground">{entity.kind}</div>
                            </button>
                        ))
                    )}
                </div>
            </ScrollArea>

            {/* Field Selector */}
            {selectedEntityId && (
                <div className="space-y-2">
                    <Label>Target Field</Label>
                    <Select value={selectedFieldName} onValueChange={onFieldChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a field..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableFields.length === 0 ? (
                                <div className="text-sm text-muted-foreground p-2">
                                    No fields available
                                </div>
                            ) : (
                                availableFields.map((field) => (
                                    <SelectItem key={field} value={field}>
                                        {field}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}

// ============================================
// MAIN BINDING DIALOG
// ============================================

interface BindingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;

    /** Source entity/field (the field that will receive the bound value) */
    sourceEntityId: string;
    sourceFieldName: string;
    sourceFieldType: string;

    /** Available entities to bind to */
    availableEntities: ParsedEntity[];

    /** Existing binding to edit (if any) */
    existingBinding?: FieldBinding;

    /** Callback when binding is saved */
    onSave?: (binding: FieldBinding) => void;
}

export function BindingDialog({
    open,
    onOpenChange,
    sourceEntityId,
    sourceFieldName,
    sourceFieldType,
    availableEntities,
    existingBinding,
    onSave,
}: BindingDialogProps) {
    const createBinding = useSetAtom(createBindingAtom);
    const updateBinding = useSetAtom(updateBindingAtom);
    const deleteBinding = useSetAtom(deleteBindingAtom);
    const checkCycle = useSetAtom(wouldCreateCycleAtom);

    // Form state
    const [bindingType, setBindingType] = useState<BindingType>(
        existingBinding?.bindingType || 'inherit'
    );
    const [targetEntityId, setTargetEntityId] = useState(
        existingBinding?.targetEntityId || ''
    );
    const [targetFieldName, setTargetFieldName] = useState(
        existingBinding?.targetFieldName || ''
    );
    const [transformType, setTransformType] = useState<TransformType>(
        existingBinding?.transform?.type || 'none'
    );
    const [transformValue, setTransformValue] = useState(
        existingBinding?.transform?.params?.value?.toString() || ''
    );
    const [aggregationFn, setAggregationFn] = useState<AggregationFunction>(
        existingBinding?.aggregationFn || 'sum'
    );
    const [allowOverride, setAllowOverride] = useState(
        existingBinding?.allowOverride ?? false
    );

    // Validation
    const [cycleWarning, setCycleWarning] = useState(false);

    const handleTargetChange = useCallback((entityId: string, fieldName: string) => {
        setTargetEntityId(entityId);
        setTargetFieldName(fieldName);

        // Check for cycles
        if (entityId && fieldName) {
            const wouldCycle = checkCycle({
                sourceEntityId,
                sourceFieldName,
                targetEntityId: entityId,
                targetFieldName: fieldName,
            });
            setCycleWarning(wouldCycle);
        }
    }, [sourceEntityId, sourceFieldName, checkCycle]);

    const handleSave = async () => {
        if (!targetEntityId || !targetFieldName) {
            toast.error('Please select a target entity and field');
            return;
        }

        if (cycleWarning) {
            toast.error('Cannot create binding: would create a circular dependency');
            return;
        }

        try {
            const options: CreateBindingOptions = {
                sourceEntityId,
                sourceFieldName,
                targetEntityId,
                targetFieldName,
                bindingType,
                allowOverride,
            };

            // Add transform if not "none"
            if (transformType !== 'none') {
                options.transform = {
                    type: transformType,
                    params: transformValue ? { value: parseFloat(transformValue) || transformValue } : undefined,
                };
            }

            // Add aggregation for aggregate bindings
            if (bindingType === 'aggregate') {
                options.aggregationFn = aggregationFn;
            }

            let binding: FieldBinding;

            if (existingBinding) {
                const updated = await updateBinding({
                    bindingId: existingBinding.id,
                    updates: {
                        transform: options.transform,
                        aggregationFn: options.aggregationFn,
                        allowOverride: options.allowOverride,
                    },
                });
                if (updated) {
                    binding = updated;
                } else {
                    throw new Error('Failed to update binding');
                }
            } else {
                binding = await createBinding(options);
            }

            toast.success(existingBinding ? 'Binding updated' : 'Binding created');
            onSave?.(binding);
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to save binding:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save binding');
        }
    };

    const handleDelete = async () => {
        if (!existingBinding) return;

        try {
            await deleteBinding(existingBinding.id);
            toast.success('Binding deleted');
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to delete binding:', error);
            toast.error('Failed to delete binding');
        }
    };

    const availableTransforms = getAvailableTransforms(sourceFieldType);
    const availableAggregations = getAvailableAggregations(sourceFieldType);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link className="h-5 w-5" />
                        {existingBinding ? 'Edit Binding' : 'Create Field Binding'}
                    </DialogTitle>
                    <DialogDescription>
                        Bind <code className="bg-muted px-1 rounded">{sourceFieldName}</code> to another entity's field.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Binding Type */}
                    <div className="space-y-2">
                        <Label>Binding Type</Label>
                        <BindingTypeSelector
                            value={bindingType}
                            onChange={setBindingType}
                        />
                        <p className="text-xs text-muted-foreground">
                            {bindingTypeInfo[bindingType].description}
                        </p>
                    </div>

                    {/* Target Entity/Field */}
                    <div className="space-y-2">
                        <Label>Target Entity & Field</Label>
                        <EntityFieldPicker
                            entities={availableEntities}
                            selectedEntityId={targetEntityId}
                            selectedFieldName={targetFieldName}
                            onEntityChange={(id) => handleTargetChange(id, '')}
                            onFieldChange={(field) => handleTargetChange(targetEntityId, field)}
                            excludeEntityId={sourceEntityId}
                            excludeFieldName={sourceFieldName}
                        />
                    </div>

                    {/* Cycle Warning */}
                    {cycleWarning && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">This binding would create a circular dependency</span>
                        </div>
                    )}

                    {/* Transform (for inherit/mirror) */}
                    {(bindingType === 'inherit' || bindingType === 'mirror') && (
                        <div className="space-y-2">
                            <Label>Transform (Optional)</Label>
                            <div className="flex gap-2">
                                <Select value={transformType} onValueChange={(v) => setTransformType(v as TransformType)}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableTransforms.map((t) => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {['multiply', 'add', 'subtract', 'divide', 'round'].includes(transformType) && (
                                    <Input
                                        type="number"
                                        placeholder="Value"
                                        value={transformValue}
                                        onChange={(e) => setTransformValue(e.target.value)}
                                        className="w-24"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Aggregation (for aggregate) */}
                    {bindingType === 'aggregate' && (
                        <div className="space-y-2">
                            <Label>Aggregation Function</Label>
                            <Select value={aggregationFn} onValueChange={(v) => setAggregationFn(v as AggregationFunction)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableAggregations.map((fn) => (
                                        <SelectItem key={fn} value={fn}>
                                            {fn.toUpperCase()} - {getAggregationDescription(fn)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Allow Override */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Allow Override</Label>
                            <p className="text-xs text-muted-foreground">
                                Let users set a custom value that overrides the binding
                            </p>
                        </div>
                        <Switch checked={allowOverride} onCheckedChange={setAllowOverride} />
                    </div>
                </div>

                <DialogFooter>
                    {existingBinding && (
                        <Button variant="destructive" onClick={handleDelete} className="mr-auto">
                            Delete
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!targetEntityId || !targetFieldName || cycleWarning}>
                        {existingBinding ? 'Update' : 'Create'} Binding
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
