/**
 * Bindable Field Wrapper
 * 
 * Wraps editable field components with binding support.
 * Shows binding indicator and provides context menu for creating bindings.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Link, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { BindingIndicator } from './BindingIndicator';
import { BindingDialog } from '../BindingDialog';
import { bindingEngine, type FieldBinding } from '@/lib/bindings';
import type { ParsedEntity } from '@/types/factSheetTypes';

interface BindableFieldWrapperProps {
    /** The entity this field belongs to */
    entityId: string;

    /** The field name */
    fieldName: string;

    /** The field type */
    fieldType: string;

    /** Available entities to bind to */
    availableEntities?: ParsedEntity[];

    /** The child component (EditableField, EditableNumber, etc.) */
    children: React.ReactNode;

    /** Optional label override */
    label?: string;

    /** ClassName for wrapper */
    className?: string;
}

export function BindableFieldWrapper({
    entityId,
    fieldName,
    fieldType,
    availableEntities = [],
    children,
    label,
    className,
}: BindableFieldWrapperProps) {
    const [bindingDialogOpen, setBindingDialogOpen] = useState(false);
    const [editingBinding, setEditingBinding] = useState<FieldBinding | undefined>();

    // Get bindings for this field
    const bindings = useMemo(() => {
        return bindingEngine.getBindingsForSource(entityId, fieldName);
    }, [entityId, fieldName]);

    const hasBinding = bindings.length > 0;
    const binding = bindings[0];

    // Find target entity name for display
    const targetEntityName = useMemo(() => {
        if (!binding) return undefined;
        const targetEntity = availableEntities.find(
            e => e.noteId === binding.targetEntityId || e.label === binding.targetEntityId
        );
        return targetEntity?.label;
    }, [binding, availableEntities]);

    const handleCreateBinding = useCallback(() => {
        setEditingBinding(undefined);
        setBindingDialogOpen(true);
    }, []);

    const handleEditBinding = useCallback(() => {
        setEditingBinding(binding);
        setBindingDialogOpen(true);
    }, [binding]);

    const handleRemoveBinding = useCallback(async () => {
        if (binding) {
            await bindingEngine.deleteBinding(binding.id);
        }
    }, [binding]);

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <div className={cn('relative group', className)}>
                        {/* Binding Indicator */}
                        {hasBinding && binding && (
                            <div className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <BindingIndicator
                                    binding={binding}
                                    targetEntityName={targetEntityName}
                                    onClick={handleEditBinding}
                                />
                            </div>
                        )}

                        {/* The actual field component */}
                        {children}
                    </div>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-52">
                    {hasBinding ? (
                        <>
                            <ContextMenuItem onClick={handleEditBinding}>
                                <Link className="h-4 w-4 mr-2" />
                                Edit Binding
                            </ContextMenuItem>
                            <ContextMenuItem onClick={handleRemoveBinding} className="text-destructive">
                                <Unlink className="h-4 w-4 mr-2" />
                                Remove Binding
                            </ContextMenuItem>
                        </>
                    ) : (
                        <ContextMenuItem onClick={handleCreateBinding}>
                            <Link className="h-4 w-4 mr-2" />
                            Create Binding...
                        </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        Field: {fieldName}
                    </div>
                </ContextMenuContent>
            </ContextMenu>

            {/* Binding Dialog */}
            <BindingDialog
                open={bindingDialogOpen}
                onOpenChange={setBindingDialogOpen}
                sourceEntityId={entityId}
                sourceFieldName={fieldName}
                sourceFieldType={fieldType}
                availableEntities={availableEntities}
                existingBinding={editingBinding}
            />
        </>
    );
}

/**
 * Hook to get binding-aware field value
 */
export function useBindableField(
    entityId: string,
    fieldName: string,
    rawValue: any,
    getFieldValue: (entityId: string, fieldName: string) => Promise<any>
) {
    const [resolvedValue, setResolvedValue] = useState(rawValue);
    const [isResolved, setIsResolved] = useState(false);

    React.useEffect(() => {
        const resolve = async () => {
            const result = await bindingEngine.resolveValue(entityId, fieldName, getFieldValue);
            setResolvedValue(result.value);
            setIsResolved(true);
        };
        resolve();
    }, [entityId, fieldName, rawValue, getFieldValue]);

    return {
        value: isResolved ? resolvedValue : rawValue,
        isResolved,
        hasBinding: bindingEngine.hasBindings(entityId, fieldName),
    };
}
