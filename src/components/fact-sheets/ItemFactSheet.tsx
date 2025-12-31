import React, { useState, useCallback } from 'react';
import { itemSchema } from '@/lib/entity-schemas/itemSchema';
import { ParsedEntity, EntityAttributes, FactSheetField } from '@/types/factSheetTypes';
import {
  FactSheetCard,
  EditableField,
  EditableNumber,
  EditableDropdown,
  EditableArray,
  ProgressBar,
  BindableFieldWrapper,
} from './cards';
import { MetaCardsSection } from './MetaCardsSection';
import { RelationshipEditorCard } from './cards/RelationshipEditorCard';

interface ItemFactSheetProps {
  entity: ParsedEntity;
  onUpdate: (attributes: EntityAttributes) => void;
}

export function ItemFactSheet({ entity, onUpdate }: ItemFactSheetProps) {
  const [attributes, setAttributes] = useState<EntityAttributes>(entity.attributes || {});

  const updateAttribute = useCallback(
    (name: string, value: any) => {
      const updated = { ...attributes, [name]: value };
      setAttributes(updated);
      onUpdate(updated);
    },
    [attributes, onUpdate]
  );

  const renderField = (field: FactSheetField) => {
    const value = attributes[field.name];
    const entityId = entity.noteId || entity.label;

    switch (field.type) {
      case 'text':
        return (
          <BindableFieldWrapper key={field.name} entityId={entityId} fieldName={field.name} fieldType="text">
            <EditableField
              label={field.label}
              value={value || ''}
              onChange={(v) => updateAttribute(field.name, v)}
              placeholder={field.placeholder}
              multiline={field.multiline}
            />
          </BindableFieldWrapper>
        );
      case 'number':
        return (
          <BindableFieldWrapper key={field.name} entityId={entityId} fieldName={field.name} fieldType="number">
            <EditableNumber
              label={field.label}
              value={value ?? field.defaultValue ?? 0}
              onChange={(v) => updateAttribute(field.name, v)}
              min={field.min}
              max={field.max}
              unit={field.unit}
            />
          </BindableFieldWrapper>
        );
      case 'dropdown':
        return (
          <BindableFieldWrapper key={field.name} entityId={entityId} fieldName={field.name} fieldType="dropdown">
            <EditableDropdown
              label={field.label}
              value={value || ''}
              onChange={(v) => updateAttribute(field.name, v)}
              options={field.options}
            />
          </BindableFieldWrapper>
        );
      case 'array':
        return (
          <BindableFieldWrapper key={field.name} entityId={entityId} fieldName={field.name} fieldType="array">
            <EditableArray
              label={field.label}
              value={value || []}
              onChange={(v) => updateAttribute(field.name, v)}
              addButtonText={field.addButtonText}
            />
          </BindableFieldWrapper>
        );
      case 'progress':
        return (
          <BindableFieldWrapper key={field.name} entityId={entityId} fieldName={field.currentField} fieldType="progress">
            <ProgressBar
              label={field.label}
              current={attributes[field.currentField] ?? 0}
              max={attributes[field.maxField] ?? 100}
              onCurrentChange={(v) => updateAttribute(field.currentField, v)}
              onMaxChange={(v) => updateAttribute(field.maxField, v)}
              color={field.color}
            />
          </BindableFieldWrapper>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-3 space-y-3 pb-20">
      <div className="text-center pb-2 border-b border-border/50">
        <span className="text-xs font-mono text-muted-foreground">ITEM</span>
        <h3 className="text-lg font-semibold text-foreground">{entity.label}</h3>
        {entity.subtype && (
          <span className="text-xs text-muted-foreground">{entity.subtype}</span>
        )}
      </div>

      {itemSchema.cards.map((card) => (
        <FactSheetCard
          key={card.id}
          title={card.title}
          icon={card.icon}
          gradient={card.gradient}
        >
          {card.fields.map(renderField)}
        </FactSheetCard>
      ))}

      {/* Unified Relationship Editor - Blueprint Hub Integration */}
      <RelationshipEditorCard entity={entity} />

      {/* User's Custom Meta Cards */}
      <MetaCardsSection entity={entity} />
    </div>
  );
}
