import React, { useState, useCallback } from 'react';
import { characterSchema } from '@/lib/entity-schemas/characterSchema';
import { ParsedEntity, EntityAttributes } from '@/types/factSheetTypes';
import {
  FactSheetCard,
  EditableField,
  EditableNumber,
  EditableDropdown,
  EditableArray,
  ProgressBar,
  StatGrid,
  RelationshipRow,
  BindableFieldWrapper,
} from './cards';
import { MetaCardsSection } from './MetaCardsSection';

interface CharacterFactSheetProps {
  entity: ParsedEntity;
  onUpdate: (attributes: EntityAttributes) => void;
}

export function CharacterFactSheet({ entity, onUpdate }: CharacterFactSheetProps) {
  const [attributes, setAttributes] = useState<EntityAttributes>(entity.attributes || {});

  const updateAttribute = useCallback(
    (name: string, value: any) => {
      const updated = { ...attributes, [name]: value };
      setAttributes(updated);
      onUpdate(updated);
    },
    [attributes, onUpdate]
  );

  const updateStat = useCallback(
    (statName: string, value: number) => {
      const stats = { ...(attributes.stats || {}) };
      stats[statName] = value;
      updateAttribute('stats', stats);
    },
    [attributes.stats, updateAttribute]
  );

  const renderField = (field: any) => {
    const value = attributes[field.name];

    switch (field.type) {
      case 'text':
        return (
          <BindableFieldWrapper
            key={field.name}
            entityId={entity.noteId || entity.label}
            fieldName={field.name}
            fieldType="text"
          >
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
          <BindableFieldWrapper
            key={field.name}
            entityId={entity.noteId || entity.label}
            fieldName={field.name}
            fieldType="number"
          >
            <EditableNumber
              label={field.label}
              value={value ?? field.defaultValue ?? 0}
              onChange={(v) => updateAttribute(field.name, v)}
              min={field.min}
              max={field.max}
              step={field.step}
              unit={field.unit}
            />
          </BindableFieldWrapper>
        );

      case 'dropdown':
        return (
          <BindableFieldWrapper
            key={field.name}
            entityId={entity.noteId || entity.label}
            fieldName={field.name}
            fieldType="dropdown"
          >
            <EditableDropdown
              label={field.label}
              value={value || ''}
              onChange={(v) => updateAttribute(field.name, v)}
              options={field.options}
              placeholder={field.placeholder}
            />
          </BindableFieldWrapper>
        );

      case 'array':
        return (
          <BindableFieldWrapper
            key={field.name}
            entityId={entity.noteId || entity.label}
            fieldName={field.name}
            fieldType="array"
          >
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
          <BindableFieldWrapper
            key={field.name}
            entityId={entity.noteId || entity.label}
            fieldName={field.currentField}
            fieldType="progress"
          >
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

      case 'stat-grid':
        const stats = field.stats.map((s: any) => ({
          name: s.name,
          abbreviation: s.abbr,
          base: attributes.stats?.[s.name] ?? 10,
          modifier: 0,
        }));
        return (
          <BindableFieldWrapper
            key={field.name}
            entityId={entity.noteId || entity.label}
            fieldName={field.name}
            fieldType="stat-grid"
          >
            <StatGrid
              label={field.label}
              stats={stats}
              onChange={updateStat}
            />
          </BindableFieldWrapper>
        );

      case 'relationship':
        const relationships = attributes.relationships || [];
        return (
          <BindableFieldWrapper
            key={field.name}
            entityId={entity.noteId || entity.label}
            fieldName={field.name}
            fieldType="relationship"
          >
            <div className="space-y-2">
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
          </BindableFieldWrapper>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-3 space-y-3 pb-20">
      {/* Entity header */}
      <div className="text-center pb-2 border-b border-border/50">
        <span className="text-xs font-mono text-muted-foreground">CHARACTER</span>
        <h3 className="text-lg font-semibold text-foreground">{entity.label}</h3>
        {entity.subtype && (
          <span className="text-xs text-muted-foreground">{entity.subtype}</span>
        )}
      </div>

      {/* Render cards from schema */}
      {characterSchema.cards.map((card) => (
        <FactSheetCard
          key={card.id}
          title={card.title}
          icon={card.icon}
          gradient={card.gradient}
        >
          {card.fields.map(renderField)}
        </FactSheetCard>
      ))}

      {/* User's Custom Meta Cards */}
      <MetaCardsSection entity={entity} />
    </div>
  );
}
