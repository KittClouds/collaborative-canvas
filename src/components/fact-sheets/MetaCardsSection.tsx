/**
 * Meta Cards Section
 * 
 * Renders user-created custom meta cards for an entity.
 * Uses the unified entity attributes hook for data.
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, MoreHorizontal, Pencil, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useUnifiedEntityAttributes } from '@/hooks/useUnifiedEntityAttributes';
import type { ParsedEntity } from '@/types/factSheetTypes';
import type { MetaCard, FieldType } from '@/atoms/entity-attributes';
import {
    GRADIENT_PRESETS,
    ICON_OPTIONS,
    getGradientClassById,
    getIconById,
    MetaCardEditor,
} from './MetaCardEditor';
import {
    EditableField,
    EditableNumber,
    EditableSlider,
    EditableCounter,
    EditableToggle,
    EditableRating,
    EditableTags,
    EditableColor,
    EditableDate,
    EditableRichText,
} from './cards';

interface MetaCardsSectionProps {
    entity: ParsedEntity;
}

/**
 * Renders a single custom meta card
 */
function CustomMetaCard({
    card,
    entity,
    onEdit,
    onDelete,
}: {
    card: MetaCard;
    entity: ParsedEntity;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [isOpen, setIsOpen] = useState(true);
    const { attributes, setField, getField } = useUnifiedEntityAttributes(entity);

    // Get fields associated with this card
    const cardFields = attributes.filter(attr => attr.cardId === card.id);

    // Parse gradient ID from stored color
    const gradientId = card.color?.replace('gradient:', '') || 'ocean';
    const gradientClass = getGradientClassById(gradientId);
    const IconComponent = getIconById(card.icon || 'user');

    // Render field based on type
    const renderField = (fieldName: string, fieldType: FieldType, value: any) => {
        const handleChange = (newValue: any) => {
            setField(fieldName, newValue, fieldType);
        };

        switch (fieldType) {
            case 'text':
                return (
                    <EditableField
                        label={fieldName}
                        value={value || ''}
                        onChange={handleChange}
                        placeholder={`Enter ${fieldName}...`}
                    />
                );

            case 'number':
                return (
                    <EditableNumber
                        label={fieldName}
                        value={value ?? 0}
                        onChange={handleChange}
                    />
                );

            case 'slider':
                return (
                    <EditableSlider
                        label={fieldName}
                        value={value ?? 50}
                        onChange={handleChange}
                        min={0}
                        max={100}
                    />
                );

            case 'counter':
                return (
                    <EditableCounter
                        label={fieldName}
                        value={value ?? 0}
                        onChange={handleChange}
                    />
                );

            case 'toggle':
                return (
                    <EditableToggle
                        label={fieldName}
                        value={value ?? false}
                        onChange={handleChange}
                    />
                );

            case 'rating':
                return (
                    <EditableRating
                        label={fieldName}
                        value={value ?? 0}
                        onChange={handleChange}
                    />
                );

            case 'tags':
                return (
                    <EditableTags
                        label={fieldName}
                        value={value ?? []}
                        onChange={handleChange}
                    />
                );

            case 'color':
                return (
                    <EditableColor
                        label={fieldName}
                        value={value ?? '#3b82f6'}
                        onChange={handleChange}
                    />
                );

            case 'date':
                return (
                    <EditableDate
                        label={fieldName}
                        value={value}
                        onChange={handleChange}
                    />
                );

            case 'rich-text':
                return (
                    <EditableRichText
                        label={fieldName}
                        value={value ?? ''}
                        onChange={handleChange}
                    />
                );

            default:
                return (
                    <EditableField
                        label={fieldName}
                        value={String(value || '')}
                        onChange={handleChange}
                    />
                );
        }
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="group">
            <div className="rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
                {/* Gradient Header */}
                <div
                    className={cn(
                        'flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r',
                        gradientClass
                    )}
                >
                    <CollapsibleTrigger className="flex items-center gap-2 flex-1">
                        <IconComponent className="h-4 w-4 text-white/90" />
                        <span className="text-sm font-medium text-white flex-1 text-left">{card.name}</span>
                        <ChevronDown
                            className={cn(
                                'h-4 w-4 text-white/70 transition-transform duration-200',
                                isOpen && 'rotate-180'
                            )}
                        />
                    </CollapsibleTrigger>

                    {/* Card Actions */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onEdit}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Card
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onDelete} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Card
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Content */}
                <CollapsibleContent>
                    <div className="p-3 space-y-3">
                        {cardFields.length === 0 ? (
                            <p className="text-sm text-muted-foreground/60 italic text-center py-2">
                                No fields yet. Click edit to add fields.
                            </p>
                        ) : (
                            cardFields.map((attr) => (
                                <div key={attr.id}>
                                    {renderField(attr.fieldName, attr.fieldType, attr.value)}
                                </div>
                            ))
                        )}
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}

/**
 * Main component that renders all custom meta cards for an entity
 */
export function MetaCardsSection({ entity }: MetaCardsSectionProps) {
    const { metaCards, deleteCard, updateCard } = useUnifiedEntityAttributes(entity);
    const [editingCard, setEditingCard] = useState<MetaCard | null>(null);

    const handleEditCard = useCallback((card: MetaCard) => {
        setEditingCard(card);
    }, []);

    const handleDeleteCard = useCallback(async (cardId: string) => {
        await deleteCard(cardId);
    }, [deleteCard]);

    const handleSaveEdit = useCallback(async (data: {
        name: string;
        gradientId: string;
        iconId: string;
    }) => {
        if (!editingCard) return;

        await updateCard(editingCard.id, {
            name: data.name,
            color: `gradient:${data.gradientId}`,
            icon: data.iconId,
        });

        setEditingCard(null);
    }, [editingCard, updateCard]);

    if (metaCards.length === 0) {
        return null;
    }

    return (
        <>
            {/* Custom Cards */}
            <div className="space-y-3">
                {metaCards.map((card) => (
                    <CustomMetaCard
                        key={card.id}
                        card={card}
                        entity={entity}
                        onEdit={() => handleEditCard(card)}
                        onDelete={() => handleDeleteCard(card.id)}
                    />
                ))}
            </div>

            {/* Edit Card Dialog */}
            <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Card</DialogTitle>
                    </DialogHeader>
                    {editingCard && (
                        <MetaCardEditor
                            card={editingCard}
                            onSave={handleSaveEdit}
                            onCancel={() => setEditingCard(null)}
                            onDelete={() => {
                                handleDeleteCard(editingCard.id);
                                setEditingCard(null);
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
