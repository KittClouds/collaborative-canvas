/**
 * Meta Card Editor
 * 
 * Component for creating and editing custom meta cards.
 * Supports gradient color selection, icon picking, and field management.
 */

import React, { useState, useCallback } from 'react';
import {
    Plus, X, GripVertical, Palette, Type, Hash, ToggleLeft, Calendar,
    Star, Tags, FileText, Link2, Sliders, ChevronDown, ChevronUp, Check,
    User, MapPin, Sword, Crown, Sparkles, Flame, Heart, Shield, Zap,
    Moon, Sun, Eye, BookOpen, MessageSquare, Flag, Target, Clock
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
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { MetaCard, FieldType } from '@/atoms/entity-attributes';

// ============================================
// GRADIENT PRESETS
// ============================================

export interface GradientPreset {
    id: string;
    name: string;
    from: string;
    to: string;
    className: string;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
    // Blues & Cyans
    { id: 'ocean', name: 'Ocean', from: '#06b6d4', to: '#3b82f6', className: 'from-cyan-500 to-blue-500' },
    { id: 'sky', name: 'Sky', from: '#0ea5e9', to: '#6366f1', className: 'from-sky-500 to-indigo-500' },
    { id: 'deep-blue', name: 'Deep Blue', from: '#1e40af', to: '#7c3aed', className: 'from-blue-800 to-violet-600' },

    // Purples & Pinks
    { id: 'violet', name: 'Violet', from: '#8b5cf6', to: '#ec4899', className: 'from-violet-500 to-pink-500' },
    { id: 'berry', name: 'Berry', from: '#a855f7', to: '#f43f5e', className: 'from-purple-500 to-rose-500' },
    { id: 'lavender', name: 'Lavender', from: '#c084fc', to: '#818cf8', className: 'from-purple-400 to-indigo-400' },

    // Greens & Teals
    { id: 'emerald', name: 'Emerald', from: '#10b981', to: '#06b6d4', className: 'from-emerald-500 to-cyan-500' },
    { id: 'forest', name: 'Forest', from: '#22c55e', to: '#14b8a6', className: 'from-green-500 to-teal-500' },
    { id: 'mint', name: 'Mint', from: '#34d399', to: '#2dd4bf', className: 'from-emerald-400 to-teal-400' },

    // Warm Colors
    { id: 'sunset', name: 'Sunset', from: '#f97316', to: '#ec4899', className: 'from-orange-500 to-pink-500' },
    { id: 'fire', name: 'Fire', from: '#ef4444', to: '#f97316', className: 'from-red-500 to-orange-500' },
    { id: 'gold', name: 'Gold', from: '#f59e0b', to: '#eab308', className: 'from-amber-500 to-yellow-500' },

    // Neutrals
    { id: 'slate', name: 'Slate', from: '#475569', to: '#64748b', className: 'from-slate-600 to-slate-500' },
    { id: 'stone', name: 'Stone', from: '#78716c', to: '#a8a29e', className: 'from-stone-500 to-stone-400' },
    { id: 'night', name: 'Night', from: '#1e293b', to: '#334155', className: 'from-slate-800 to-slate-700' },
];

// ============================================
// ICON OPTIONS
// ============================================

export interface IconOption {
    id: string;
    name: string;
    icon: typeof User;
}

export const ICON_OPTIONS: IconOption[] = [
    { id: 'user', name: 'User', icon: User },
    { id: 'map-pin', name: 'Location', icon: MapPin },
    { id: 'sword', name: 'Combat', icon: Sword },
    { id: 'crown', name: 'Status', icon: Crown },
    { id: 'sparkles', name: 'Magic', icon: Sparkles },
    { id: 'flame', name: 'Power', icon: Flame },
    { id: 'heart', name: 'Relationships', icon: Heart },
    { id: 'shield', name: 'Defense', icon: Shield },
    { id: 'zap', name: 'Energy', icon: Zap },
    { id: 'moon', name: 'Night', icon: Moon },
    { id: 'sun', name: 'Day', icon: Sun },
    { id: 'eye', name: 'Perception', icon: Eye },
    { id: 'book-open', name: 'Lore', icon: BookOpen },
    { id: 'message-square', name: 'Dialogue', icon: MessageSquare },
    { id: 'flag', name: 'Faction', icon: Flag },
    { id: 'target', name: 'Goals', icon: Target },
    { id: 'clock', name: 'Timeline', icon: Clock },
    { id: 'star', name: 'Important', icon: Star },
];

// ============================================
// FIELD TYPE OPTIONS
// ============================================

export interface FieldTypeOption {
    type: FieldType;
    label: string;
    description: string;
    icon: typeof Type;
}

export const FIELD_TYPE_OPTIONS: FieldTypeOption[] = [
    { type: 'text', label: 'Text', description: 'Single or multiline text', icon: Type },
    { type: 'number', label: 'Number', description: 'Numeric value', icon: Hash },
    { type: 'toggle', label: 'Toggle', description: 'On/Off switch', icon: ToggleLeft },
    { type: 'slider', label: 'Slider', description: 'Value on a scale', icon: Sliders },
    { type: 'counter', label: 'Counter', description: '+/- buttons', icon: Hash },
    { type: 'rating', label: 'Rating', description: 'Star rating', icon: Star },
    { type: 'date', label: 'Date', description: 'Calendar date', icon: Calendar },
    { type: 'tags', label: 'Tags', description: 'Multiple tags', icon: Tags },
    { type: 'color', label: 'Color', description: 'Color picker', icon: Palette },
    { type: 'rich-text', label: 'Rich Text', description: 'Formatted text', icon: FileText },
    { type: 'entity-link', label: 'Entity Link', description: 'Link to entity', icon: Link2 },
];

// ============================================
// GRADIENT PICKER COMPONENT
// ============================================

interface GradientPickerProps {
    value: string;
    onChange: (gradient: GradientPreset) => void;
}

export function GradientPicker({ value, onChange }: GradientPickerProps) {
    const currentGradient = GRADIENT_PRESETS.find(g => g.id === value) || GRADIENT_PRESETS[0];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2 h-10">
                    <div
                        className={cn(
                            'h-6 w-12 rounded-md bg-gradient-to-r',
                            currentGradient.className
                        )}
                    />
                    <span className="text-sm">{currentGradient.name}</span>
                    <Palette className="ml-auto h-4 w-4 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
                <div className="grid grid-cols-3 gap-2">
                    {GRADIENT_PRESETS.map((gradient) => (
                        <button
                            key={gradient.id}
                            onClick={() => onChange(gradient)}
                            className={cn(
                                'h-10 rounded-md bg-gradient-to-r transition-all hover:scale-105',
                                gradient.className,
                                value === gradient.id && 'ring-2 ring-white ring-offset-2 ring-offset-background'
                            )}
                            title={gradient.name}
                        >
                            {value === gradient.id && (
                                <Check className="h-4 w-4 text-white mx-auto" />
                            )}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ============================================
// ICON PICKER COMPONENT
// ============================================

interface IconPickerProps {
    value: string;
    onChange: (iconId: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
    const currentIcon = ICON_OPTIONS.find(i => i.id === value) || ICON_OPTIONS[0];
    const CurrentIconComponent = currentIcon.icon;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2 h-10">
                    <CurrentIconComponent className="h-4 w-4" />
                    <span className="text-sm">{currentIcon.name}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
                <div className="grid grid-cols-6 gap-2">
                    {ICON_OPTIONS.map((option) => {
                        const IconComponent = option.icon;
                        return (
                            <button
                                key={option.id}
                                onClick={() => onChange(option.id)}
                                className={cn(
                                    'h-9 w-9 rounded-md flex items-center justify-center transition-colors',
                                    'hover:bg-muted',
                                    value === option.id && 'bg-primary text-primary-foreground'
                                )}
                                title={option.name}
                            >
                                <IconComponent className="h-4 w-4" />
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ============================================
// FIELD PALETTE COMPONENT
// ============================================

interface FieldPaletteProps {
    onAddField: (fieldType: FieldType, fieldName: string) => void;
}

export function FieldPalette({ onAddField }: FieldPaletteProps) {
    const [selectedType, setSelectedType] = useState<FieldType | null>(null);
    const [fieldName, setFieldName] = useState('');

    const handleAdd = () => {
        if (selectedType && fieldName.trim()) {
            onAddField(selectedType, fieldName.trim());
            setFieldName('');
            setSelectedType(null);
        }
    };

    return (
        <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Add Field</Label>

            <div className="grid grid-cols-4 gap-2">
                {FIELD_TYPE_OPTIONS.slice(0, 8).map((option) => {
                    const IconComponent = option.icon;
                    return (
                        <button
                            key={option.type}
                            onClick={() => setSelectedType(selectedType === option.type ? null : option.type)}
                            className={cn(
                                'flex flex-col items-center gap-1 p-2 rounded-md text-xs transition-colors',
                                'hover:bg-muted border border-transparent',
                                selectedType === option.type && 'bg-primary/10 border-primary text-primary'
                            )}
                            title={option.description}
                        >
                            <IconComponent className="h-4 w-4" />
                            <span className="truncate w-full text-center">{option.label}</span>
                        </button>
                    );
                })}
            </div>

            {selectedType && (
                <div className="flex gap-2">
                    <Input
                        placeholder="Field name..."
                        value={fieldName}
                        onChange={(e) => setFieldName(e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <Button size="sm" onClick={handleAdd} disabled={!fieldName.trim()}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}

// ============================================
// CREATE CARD DIALOG
// ============================================

interface CreateCardDialogProps {
    onCreateCard: (data: { name: string; gradientId: string; iconId: string }) => void;
    trigger?: React.ReactNode;
}

export function CreateCardDialog({ onCreateCard, trigger }: CreateCardDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [gradientId, setGradientId] = useState('ocean');
    const [iconId, setIconId] = useState('user');

    const handleCreate = () => {
        if (name.trim()) {
            onCreateCard({
                name: name.trim(),
                gradientId,
                iconId,
            });
            setName('');
            setGradientId('ocean');
            setIconId('user');
            setOpen(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Card
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create New Card</DialogTitle>
                    <DialogDescription>
                        Add a custom card to organize entity attributes.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Preview */}
                    <div
                        className={cn(
                            'flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r',
                            GRADIENT_PRESETS.find(g => g.id === gradientId)?.className
                        )}
                    >
                        {(() => {
                            const IconComponent = ICON_OPTIONS.find(i => i.id === iconId)?.icon || User;
                            return <IconComponent className="h-4 w-4 text-white/90" />;
                        })()}
                        <span className="text-sm font-medium text-white flex-1">
                            {name || 'Card Name'}
                        </span>
                        <ChevronDown className="h-4 w-4 text-white/70" />
                    </div>

                    {/* Name Input */}
                    <div className="space-y-2">
                        <Label>Card Name</Label>
                        <Input
                            placeholder="e.g., Combat Stats, Relationships..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                    </div>

                    {/* Gradient Picker */}
                    <div className="space-y-2">
                        <Label>Color Theme</Label>
                        <GradientPicker
                            value={gradientId}
                            onChange={(g) => setGradientId(g.id)}
                        />
                    </div>

                    {/* Icon Picker */}
                    <div className="space-y-2">
                        <Label>Icon</Label>
                        <IconPicker value={iconId} onChange={setIconId} />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={!name.trim()}>
                        Create Card
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ============================================
// DRAGGABLE FIELD ITEM
// ============================================

interface DraggableFieldProps {
    fieldName: string;
    fieldType: FieldType;
    onRemove: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    isFirst?: boolean;
    isLast?: boolean;
}

export function DraggableField({
    fieldName,
    fieldType,
    onRemove,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
}: DraggableFieldProps) {
    const typeOption = FIELD_TYPE_OPTIONS.find(o => o.type === fieldType);
    const IconComponent = typeOption?.icon || Type;

    return (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group hover:bg-muted transition-colors">
            <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
            <IconComponent className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-sm truncate">{fieldName}</span>
            <span className="text-xs text-muted-foreground/60">{typeOption?.label}</span>

            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isFirst && onMoveUp && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp}>
                        <ChevronUp className="h-3 w-3" />
                    </Button>
                )}
                {!isLast && onMoveDown && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown}>
                        <ChevronDown className="h-3 w-3" />
                    </Button>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onRemove}>
                    <X className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}

// ============================================
// META CARD EDITOR COMPONENT
// ============================================

interface MetaCardEditorField {
    id: string;
    fieldName: string;
    fieldType: FieldType;
}

interface MetaCardEditorProps {
    card?: MetaCard;
    fields?: MetaCardEditorField[];
    onSave: (data: {
        name: string;
        gradientId: string;
        iconId: string;
        fields: MetaCardEditorField[];
    }) => void;
    onDelete?: () => void;
    onCancel: () => void;
}

export function MetaCardEditor({
    card,
    fields: initialFields = [],
    onSave,
    onDelete,
    onCancel,
}: MetaCardEditorProps) {
    const [name, setName] = useState(card?.name || '');
    const [gradientId, setGradientId] = useState(
        card?.color?.startsWith('gradient:') ? card.color.replace('gradient:', '') : 'ocean'
    );
    const [iconId, setIconId] = useState(card?.icon || 'user');
    const [fields, setFields] = useState<MetaCardEditorField[]>(initialFields);

    const handleAddField = useCallback((fieldType: FieldType, fieldName: string) => {
        setFields(prev => [
            ...prev,
            {
                id: `field-${Date.now()}`,
                fieldName,
                fieldType,
            },
        ]);
    }, []);

    const handleRemoveField = useCallback((id: string) => {
        setFields(prev => prev.filter(f => f.id !== id));
    }, []);

    const handleMoveField = useCallback((index: number, direction: 'up' | 'down') => {
        setFields(prev => {
            const newFields = [...prev];
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
            return newFields;
        });
    }, []);

    const handleSave = () => {
        onSave({
            name,
            gradientId,
            iconId,
            fields,
        });
    };

    return (
        <div className="space-y-4">
            {/* Live Preview */}
            <div
                className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r',
                    GRADIENT_PRESETS.find(g => g.id === gradientId)?.className
                )}
            >
                {(() => {
                    const IconComponent = ICON_OPTIONS.find(i => i.id === iconId)?.icon || User;
                    return <IconComponent className="h-4 w-4 text-white/90" />;
                })()}
                <span className="text-sm font-medium text-white flex-1">
                    {name || 'Card Name'}
                </span>
                <ChevronDown className="h-4 w-4 text-white/70" />
            </div>

            {/* Name */}
            <div className="space-y-2">
                <Label>Card Name</Label>
                <Input
                    placeholder="e.g., Combat Stats"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>

            {/* Color & Icon Row */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label>Color Theme</Label>
                    <GradientPicker
                        value={gradientId}
                        onChange={(g) => setGradientId(g.id)}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Icon</Label>
                    <IconPicker value={iconId} onChange={setIconId} />
                </div>
            </div>

            {/* Fields List */}
            <div className="space-y-2">
                <Label>Fields ({fields.length})</Label>
                <ScrollArea className="h-[200px] rounded-md border border-border/50 p-2">
                    {fields.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
                            No fields added yet
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {fields.map((field, index) => (
                                <DraggableField
                                    key={field.id}
                                    fieldName={field.fieldName}
                                    fieldType={field.fieldType}
                                    onRemove={() => handleRemoveField(field.id)}
                                    onMoveUp={index > 0 ? () => handleMoveField(index, 'up') : undefined}
                                    onMoveDown={index < fields.length - 1 ? () => handleMoveField(index, 'down') : undefined}
                                    isFirst={index === 0}
                                    isLast={index === fields.length - 1}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Field Palette */}
            <FieldPalette onAddField={handleAddField} />

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                {onDelete && (
                    <Button variant="destructive" size="sm" onClick={onDelete}>
                        Delete Card
                    </Button>
                )}
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={onCancel}>
                    Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
                    Save Card
                </Button>
            </div>
        </div>
    );
}

// Helper to get icon component by ID
export function getIconById(iconId: string): typeof User {
    return ICON_OPTIONS.find(i => i.id === iconId)?.icon || User;
}

// Helper to get gradient class by ID
export function getGradientClassById(gradientId: string): string {
    return GRADIENT_PRESETS.find(g => g.id === gradientId)?.className || GRADIENT_PRESETS[0].className;
}
