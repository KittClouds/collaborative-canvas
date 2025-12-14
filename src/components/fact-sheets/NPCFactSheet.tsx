import React, { useState, useCallback } from 'react';
import { npcSchema } from '@/lib/entity-schemas/npcSchema';
import { ParsedEntity, EntityAttributes, FactSheetField } from '@/types/factSheetTypes';
import {
  FactSheetCard,
  EditableField,
  EditableNumber,
  EditableDropdown,
  EditableArray,
  ProgressBar,
  RelationshipRow,
} from './cards';

interface NPCFactSheetProps {
  entity: ParsedEntity;
  onUpdate: (attributes: EntityAttributes) => void;
}

export function NPCFactSheet({ entity, onUpdate }: NPCFactSheetProps) {
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
      case 'relationship':
        const relationships = attributes.relationships || [];
        return (
          <div key={field.name} className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
            {relationships.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic">No relationships yet</p>
            ) : (
              relationships.map((rel: any, index: number) => (
                <RelationshipRow
                  key={index}
                  name={rel.name}
                  type={rel.type}
                  standing={rel.standing}
                  faction={rel.faction}
                  onStandingChange={(v) => {
                    const updated = [...relationships];
                    updated[index] = { ...updated[index], standing: v };
                    updateAttribute('relationships', updated);
                  }}
                />
              ))
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="text-center pb-2 border-b border-border/50">
        <span className="text-xs font-mono text-muted-foreground">NPC</span>
        <h3 className="text-lg font-semibold text-foreground">{entity.label}</h3>
        {entity.subtype && (
          <span className="text-xs text-muted-foreground">{entity.subtype}</span>
        )}
      </div>

      {npcSchema.cards.map((card) => (
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
