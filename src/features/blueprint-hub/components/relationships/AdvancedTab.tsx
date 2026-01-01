import { useState, useEffect } from 'react';
import { EntityKindSelector } from './EntityKindSelector';
import { RelationshipPreview } from '../previews/RelationshipPreview';
import { TagInput } from '../TagInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ENTITY_COLORS, type EntityKind } from '@/lib/types/entityTypes';
import type {
  RelationshipDirection,
  RelationshipCardinality,
  CreateRelationshipTypeInput,
} from '../../types';

interface AdvancedTabProps {
  onCreate: (input: Omit<CreateRelationshipTypeInput, 'version_id'>) => Promise<void>;
  onCancel: () => void;
  entityTypes: Array<{ entity_kind: string; display_name: string; color?: string }>;
}

const CARDINALITY_OPTIONS: Array<{ value: RelationshipCardinality; label: string }> = [
  { value: 'one_to_one', label: 'One to One (1:1)' },
  { value: 'one_to_many', label: 'One to Many (1:N)' },
  { value: 'many_to_one', label: 'Many to One (N:1)' },
  { value: 'many_to_many', label: 'Many to Many (N:N)' },
];

const DIRECTION_OPTIONS: Array<{ value: RelationshipDirection; label: string }> = [
  { value: 'directed', label: 'Directed (one-way)' },
  { value: 'bidirectional', label: 'Bidirectional (two-way)' },
  { value: 'undirected', label: 'Undirected (symmetric)' },
];

export function AdvancedTab({ onCreate, onCancel, entityTypes }: AdvancedTabProps) {
  const [formData, setFormData] = useState({
    relationship_name: '',
    display_label: '',
    source_entity_kind: '',
    target_entity_kind: '',
    direction: 'directed' as RelationshipDirection,
    cardinality: 'many_to_one' as RelationshipCardinality,
    is_symmetric: false,
    inverse_label: '',
    description: '',
    // Extraction pattern fields
    verb_patterns: [] as string[],
    confidence: 0.75,
    pattern_category: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (formData.is_symmetric) {
      setFormData((prev) => ({ ...prev, direction: 'undirected' }));
    }
  }, [formData.is_symmetric]);

  const sourceType = entityTypes.find(et => et.entity_kind === formData.source_entity_kind);
  const targetType = entityTypes.find(et => et.entity_kind === formData.target_entity_kind);

  const sourceColor = sourceType?.color || ENTITY_COLORS[formData.source_entity_kind as EntityKind];
  const targetColor = targetType?.color || ENTITY_COLORS[formData.target_entity_kind as EntityKind];

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.relationship_name.trim()) {
      newErrors.relationship_name = 'Relationship name is required';
    } else if (!/^[a-z][a-z0-9_]*$/.test(formData.relationship_name)) {
      newErrors.relationship_name = 'Must be lowercase with underscores only';
    }

    if (!formData.display_label.trim()) {
      newErrors.display_label = 'Display label is required';
    }

    if (!formData.source_entity_kind) {
      newErrors.source_entity_kind = 'Source type is required';
    }

    if (!formData.target_entity_kind) {
      newErrors.target_entity_kind = 'Target type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onCreate({
        relationship_name: formData.relationship_name.trim(),
        display_label: formData.display_label.trim(),
        source_entity_kind: formData.source_entity_kind,
        target_entity_kind: formData.target_entity_kind,
        direction: formData.direction,
        cardinality: formData.cardinality,
        is_symmetric: formData.is_symmetric,
        inverse_label: formData.direction === 'bidirectional' ? formData.inverse_label || undefined : undefined,
        description: formData.description.trim() || undefined,
        // Include extraction pattern fields
        verb_patterns: formData.verb_patterns.length > 0 ? formData.verb_patterns : undefined,
        confidence: formData.verb_patterns.length > 0 ? formData.confidence : undefined,
        pattern_category: formData.pattern_category || undefined,
      });
    } catch (err) {
      console.error('Failed to create relationship type:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-1 overflow-y-auto">
      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Identity
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="relationship_name">Relationship Name (Key)</Label>
            <Input
              id="relationship_name"
              value={formData.relationship_name}
              onChange={(e) => setFormData({ ...formData, relationship_name: e.target.value })}
              placeholder="e.g., character_member_of_faction"
              className={errors.relationship_name ? 'border-destructive' : ''}
            />
            {errors.relationship_name && (
              <p className="text-xs text-destructive">{errors.relationship_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_label">Display Label</Label>
            <Input
              id="display_label"
              value={formData.display_label}
              onChange={(e) => setFormData({ ...formData, display_label: e.target.value })}
              placeholder="e.g., member of"
              className={errors.display_label ? 'border-destructive' : ''}
            />
            {errors.display_label && (
              <p className="text-xs text-destructive">{errors.display_label}</p>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Entity Binding
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Source Entity Kind</Label>
            <EntityKindSelector
              value={formData.source_entity_kind}
              onChange={(value) => setFormData({ ...formData, source_entity_kind: value })}
              placeholder="Select source type"
            />
            {errors.source_entity_kind && (
              <p className="text-xs text-destructive">{errors.source_entity_kind}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Target Entity Kind</Label>
            <EntityKindSelector
              value={formData.target_entity_kind}
              onChange={(value) => setFormData({ ...formData, target_entity_kind: value })}
              placeholder="Select target type"
            />
            {errors.target_entity_kind && (
              <p className="text-xs text-destructive">{errors.target_entity_kind}</p>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Relationship Properties
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Direction</Label>
            <Select
              value={formData.direction}
              onValueChange={(value) => setFormData({ ...formData, direction: value as RelationshipDirection })}
              disabled={formData.is_symmetric}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {DIRECTION_OPTIONS.map((opt) => (
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
              onValueChange={(value) => setFormData({ ...formData, cardinality: value as RelationshipCardinality })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {CARDINALITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Symmetric</Label>
            <div className="flex items-center h-10">
              <Switch
                checked={formData.is_symmetric}
                onCheckedChange={(checked) => setFormData({ ...formData, is_symmetric: checked })}
              />
            </div>
          </div>
        </div>

        {formData.direction === 'bidirectional' && !formData.is_symmetric && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <Label htmlFor="inverse_label">Inverse Label</Label>
            <Input
              id="inverse_label"
              value={formData.inverse_label}
              onChange={(e) => setFormData({ ...formData, inverse_label: e.target.value })}
              placeholder="e.g., has member"
            />
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Documentation
        </h4>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe when and how this relationship should be used..."
            rows={3}
          />
        </div>
      </div>

      {/* Extraction Patterns Section */}
      <div className="border rounded-lg p-4 space-y-4 border-dashed border-blue-500/30 bg-blue-500/5">
        <h4 className="text-xs font-medium text-blue-400 uppercase tracking-wide flex items-center gap-2">
          <span>⚡</span> Extraction Patterns (Optional)
        </h4>

        <p className="text-xs text-muted-foreground">
          Define verb lemmas that will automatically extract this relationship from text.
          <br />
          Example: "Jon <strong className="text-blue-400">defeated</strong> the Orcs" → DEFEATED relationship
        </p>

        <div className="space-y-2">
          <Label>Verb Lemmas</Label>
          <TagInput
            tags={formData.verb_patterns}
            onTagsChange={(tags) => setFormData({ ...formData, verb_patterns: tags })}
            placeholder="defeat, kill, slay (press Enter)"
          />
          <p className="text-xs text-muted-foreground">
            Enter verb lemmas in lowercase (base form). Example: "defeat" not "defeated"
          </p>
        </div>

        {formData.verb_patterns.length > 0 && (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                Confidence Score
                <span className="text-xs text-muted-foreground font-normal">
                  {(formData.confidence * 100).toFixed(0)}%
                </span>
              </Label>
              <Slider
                value={[formData.confidence]}
                onValueChange={([value]) => setFormData({ ...formData, confidence: value })}
                min={0.1}
                max={1.0}
                step={0.05}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.pattern_category}
                onValueChange={(value) => setFormData({ ...formData, pattern_category: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  <SelectItem value="combat">Combat</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="possession">Possession</SelectItem>
                  <SelectItem value="spatial">Spatial</SelectItem>
                  <SelectItem value="familial">Familial</SelectItem>
                  <SelectItem value="organizational">Organizational</SelectItem>
                  <SelectItem value="emotional">Emotional</SelectItem>
                  <SelectItem value="creation">Creation</SelectItem>
                  <SelectItem value="hierarchy">Hierarchy</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
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

      <div className="flex justify-end gap-3 pt-4 border-t mt-auto">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Relationship'}
        </Button>
      </div>
    </div>
  );
}
