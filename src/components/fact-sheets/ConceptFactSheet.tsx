import React, { useState, useCallback } from 'react';
import { conceptSchema } from '@/lib/entity-schemas/conceptSchema';
import { ParsedEntity, EntityAttributes, FactSheetField } from '@/types/factSheetTypes';
import {
  FactSheetCard,
  EditableField,
  EditableNumber,
  EditableDropdown,
  EditableArray,
  ProgressBar,
} from './cards';

interface ConceptFactSheetProps {
  entity: ParsedEntity;
  onUpdate: (attributes: EntityAttributes) => void;
}

export function ConceptFactSheet({ entity, onUpdate }: ConceptFactSheetProps) {
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

    switch (field.type) {
      case 'text':
        return (
          <EditableField
            key={field.name}
            label={field.label}
            value={value || ''}
            onChange={(v) => updateAttribute(field.name, v)}
            placeholder={field.placeholder}
            multiline={field.multiline}
          />
        );
      case 'number':
        return (
          <EditableNumber
            key={field.name}
            label={field.label}
            value={value ?? field.defaultValue ?? 0}
            onChange={(v) => updateAttribute(field.name, v)}
            min={field.min}
            max={field.max}
            unit={field.unit}
          />
        );
      case 'dropdown':
        return (
          <EditableDropdown
            key={field.name}
            label={field.label}
            value={value || ''}
            onChange={(v) => updateAttribute(field.name, v)}
            options={field.options}
          />
        );
      case 'array':
        return (
          <EditableArray
            key={field.name}
            label={field.label}
            value={value || []}
            onChange={(v) => updateAttribute(field.name, v)}
            addButtonText={field.addButtonText}
          />
        );
      case 'progress':
        return (
          <ProgressBar
            key={field.name}
            label={field.label}
            current={attributes[field.currentField] ?? 0}
            max={attributes[field.maxField] ?? 100}
            onCurrentChange={(v) => updateAttribute(field.currentField, v)}
            onMaxChange={(v) => updateAttribute(field.maxField, v)}
            color={field.color}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="text-center pb-2 border-b border-border/50">
        <span className="text-xs font-mono text-muted-foreground">CONCEPT</span>
        <h3 className="text-lg font-semibold text-foreground">{entity.label}</h3>
        {entity.subtype && (
          <span className="text-xs text-muted-foreground">{entity.subtype}</span>
        )}
      </div>

      {conceptSchema.cards.map((card) => (
        <FactSheetCard
          key={card.id}
          title={card.title}
          icon={card.icon}
          gradient={card.gradient}
        >
          {card.fields.map(renderField)}
        </FactSheetCard>
      ))}
    </div>
  );
}
