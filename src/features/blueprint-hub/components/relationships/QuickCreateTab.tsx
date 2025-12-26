import { useState, useEffect } from 'react';
import { EntityKindSelector } from './EntityKindSelector';
import { RelationshipPreview } from '../previews/RelationshipPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowRight, ArrowLeftRight, Minus } from 'lucide-react';
import { ENTITY_COLORS, type EntityKind } from '@/lib/entities/entityTypes';
import type { RelationshipDirection, CreateRelationshipTypeInput } from '../../types';
import type { RelationshipPreset } from './relationshipPresets';

interface QuickCreateTabProps {
  onCreate: (input: Omit<CreateRelationshipTypeInput, 'version_id'>) => Promise<void>;
  onCancel: () => void;
  initialData?: RelationshipPreset;
  entityTypes: Array<{ entity_kind: string; display_name: string; color?: string }>;
}

function generateRelationshipName(source: string, label: string, target: string): string {
  const cleanLabel = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return `${source.toLowerCase()}_${cleanLabel}_${target.toLowerCase()}`;
}

export function QuickCreateTab({
  onCreate,
  onCancel,
  initialData,
  entityTypes,
}: QuickCreateTabProps) {
  const [formData, setFormData] = useState({
    source_entity_kind: initialData?.source_entity_kind || '',
    target_entity_kind: initialData?.target_entity_kind || '',
    display_label: initialData?.display_label || '',
    direction: (initialData?.direction || 'directed') as RelationshipDirection,
    inverse_label: initialData?.inverse_label || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        source_entity_kind: initialData.source_entity_kind,
        target_entity_kind: initialData.target_entity_kind,
        display_label: initialData.display_label,
        direction: initialData.direction,
        inverse_label: initialData.inverse_label || '',
      });
    }
  }, [initialData]);

  const sourceType = entityTypes.find(et => et.entity_kind === formData.source_entity_kind);
  const targetType = entityTypes.find(et => et.entity_kind === formData.target_entity_kind);

  const sourceColor = sourceType?.color || ENTITY_COLORS[formData.source_entity_kind as EntityKind];
  const targetColor = targetType?.color || ENTITY_COLORS[formData.target_entity_kind as EntityKind];

  const canSubmit =
    formData.source_entity_kind &&
    formData.target_entity_kind &&
    formData.display_label.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const relationshipName = generateRelationshipName(
        formData.source_entity_kind,
        formData.display_label,
        formData.target_entity_kind
      );

      await onCreate({
        relationship_name: relationshipName,
        display_label: formData.display_label.trim(),
        source_entity_kind: formData.source_entity_kind,
        target_entity_kind: formData.target_entity_kind,
        direction: formData.direction,
        inverse_label: formData.direction === 'bidirectional' ? formData.inverse_label || undefined : undefined,
      });
    } catch (err) {
      console.error('Failed to create relationship type:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 p-1">
      <div className="grid grid-cols-[1fr,auto,1fr,auto,1fr] gap-3 items-end">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Source
          </Label>
          <EntityKindSelector
            value={formData.source_entity_kind}
            onChange={(value) => setFormData({ ...formData, source_entity_kind: value })}
            placeholder="From..."
          />
        </div>

        <div className="flex items-center justify-center pb-2">
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Relationship
          </Label>
          <Input
            value={formData.display_label}
            onChange={(e) => setFormData({ ...formData, display_label: e.target.value })}
            placeholder="e.g., belongs to"
            className="text-center font-medium"
          />
        </div>

        <div className="flex items-center justify-center pb-2">
          <ArrowRight className="w-5 h-5 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Target
          </Label>
          <EntityKindSelector
            value={formData.target_entity_kind}
            onChange={(value) => setFormData({ ...formData, target_entity_kind: value })}
            placeholder="To..."
          />
        </div>
      </div>

      {formData.source_entity_kind && formData.target_entity_kind && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <RelationshipPreview
            fromType={{
              display_name: sourceType?.display_name || formData.source_entity_kind,
              color: sourceColor,
            }}
            toType={{
              display_name: targetType?.display_name || formData.target_entity_kind,
              color: targetColor,
            }}
            relationship={{
              direction: formData.direction,
              display_label: formData.display_label || 'relates to',
              inverse_label: formData.inverse_label,
            }}
          />
        </div>
      )}

      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Direction
        </Label>
        <RadioGroup
          value={formData.direction}
          onValueChange={(value) => setFormData({ ...formData, direction: value as RelationshipDirection })}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="directed" id="directed" />
            <Label htmlFor="directed" className="flex items-center gap-1.5 cursor-pointer">
              <ArrowRight className="w-4 h-4" />
              <span>One-way</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="bidirectional" id="bidirectional" />
            <Label htmlFor="bidirectional" className="flex items-center gap-1.5 cursor-pointer">
              <ArrowLeftRight className="w-4 h-4" />
              <span>Two-way</span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="undirected" id="undirected" />
            <Label htmlFor="undirected" className="flex items-center gap-1.5 cursor-pointer">
              <Minus className="w-4 h-4" />
              <span>Symmetric</span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {formData.direction === 'bidirectional' && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Label htmlFor="inverse_label" className="text-xs text-muted-foreground uppercase tracking-wide">
            Inverse Label (Optional)
          </Label>
          <Input
            id="inverse_label"
            value={formData.inverse_label}
            onChange={(e) => setFormData({ ...formData, inverse_label: e.target.value })}
            placeholder="e.g., has member"
          />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t mt-auto">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Relationship'}
        </Button>
      </div>
    </div>
  );
}
