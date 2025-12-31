import { useState, useEffect } from 'react';
import { useBlueprintHubContext } from '../../context/BlueprintHubContext';
import { useRelationshipTypes } from '../../hooks/useRelationshipTypes';
import { useAttributeBlueprints } from '../../hooks/useAttributeBlueprints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';
import type { FieldDataType } from '../../types';

const ATTRIBUTE_DATA_TYPES: FieldDataType[] = [
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'text',
  'json',
];

interface AttributeBlueprintsTabProps {
  isLoading: boolean;
}

export function AttributeBlueprintsTab({ isLoading: contextLoading }: AttributeBlueprintsTabProps) {
  const { versionId } = useBlueprintHubContext();
  const { relationshipTypes, isLoading: relationshipsLoading } = useRelationshipTypes(versionId);

  const [selectedRelationshipTypeId, setSelectedRelationshipTypeId] = useState<string | null>(null);
  const { attributes, isLoading: attributesLoading, create, remove } = useAttributeBlueprints(selectedRelationshipTypeId);

  const [view, setView] = useState<'list' | 'create'>('list');
  const [formData, setFormData] = useState({
    attribute_name: '',
    display_label: '',
    data_type: '' as FieldDataType | '',
    is_required: false,
    description: '',
    default_value: '',
  });

  const isLoading = contextLoading || relationshipsLoading || attributesLoading;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && view !== 'list') {
        setView('list');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view]);

  const selectedRelationshipType = relationshipTypes.find(rt => rt.relationship_type_id === selectedRelationshipTypeId);

  const handleCreate = async () => {
    if (!selectedRelationshipTypeId || !formData.attribute_name || !formData.display_label || !formData.data_type) {
      return;
    }

    try {
      await create({
        relationship_type_id: selectedRelationshipTypeId,
        attribute_name: formData.attribute_name,
        display_label: formData.display_label,
        data_type: formData.data_type as FieldDataType,
        is_required: formData.is_required,
        description: formData.description || undefined,
        default_value: formData.default_value || undefined,
      });

      setFormData({
        attribute_name: '',
        display_label: '',
        data_type: '',
        is_required: false,
        description: '',
        default_value: '',
      });
      setView('list');
    } catch (err) {
      console.error('Failed to create attribute:', err);
    }
  };

  const handleDelete = async (attributeId: string) => {
    if (confirm('Are you sure you want to delete this attribute?')) {
      try {
        await remove(attributeId);
      } catch (err) {
        console.error('Failed to delete attribute:', err);
      }
    }
  };

  if (isLoading && relationshipTypes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading relationship attributes...</div>
      </div>
    );
  }

  if (relationshipTypes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p>No relationship types defined yet.</p>
          <p className="text-sm mt-2">Create a relationship type first in the Relationships tab.</p>
        </div>
      </div>
    );
  }

  if (view === 'create' && selectedRelationshipType) {
    return (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('list')}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h3 className="text-lg font-semibold">Add Attribute to {selectedRelationshipType.display_label}</h3>
            <p className="text-sm text-muted-foreground">
              Define a new attribute for this relationship type.
            </p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="attribute_name">Attribute Name (camelCase)</Label>
            <Input
              id="attribute_name"
              value={formData.attribute_name}
              onChange={(e) => setFormData({ ...formData, attribute_name: e.target.value })}
              placeholder="e.g., strength"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_label">Display Label</Label>
            <Input
              id="display_label"
              value={formData.display_label}
              onChange={(e) => setFormData({ ...formData, display_label: e.target.value })}
              placeholder="e.g., Relationship Strength"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_type">Data Type</Label>
            <Select
              value={formData.data_type}
              onValueChange={(value) => setFormData({ ...formData, data_type: value as FieldDataType })}
            >
              <SelectTrigger id="data_type">
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {ATTRIBUTE_DATA_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_required"
              checked={formData.is_required}
              onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked === true })}
            />
            <Label htmlFor="is_required" className="font-normal cursor-pointer">Required</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_value">Default Value (Optional)</Label>
            <Input
              id="default_value"
              value={formData.default_value}
              onChange={(e) => setFormData({ ...formData, default_value: e.target.value })}
              placeholder="Initial value for this attribute"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Helpful context for this attribute"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setView('list')}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.attribute_name || !formData.display_label || !formData.data_type}
            >
              Create Attribute
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 animate-in fade-in duration-200">
      <div className="w-80 border-r pr-4 space-y-2">
        <h4 className="text-sm font-semibold mb-3 px-3">Relationship Types</h4>
        <div className="space-y-1">
          {relationshipTypes.map((relType) => (
            <button
              key={relType.relationship_type_id}
              onClick={() => {
                setSelectedRelationshipTypeId(relType.relationship_type_id);
                setView('list');
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedRelationshipTypeId === relType.relationship_type_id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
            >
              <div className="space-y-1">
                <div className="font-medium truncate">{relType.display_label}</div>
                <div className="flex items-center gap-1 text-xs opacity-80">
                  <span className="truncate">{relType.source_entity_kind}</span>
                  <ArrowRight className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{relType.target_entity_kind}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedRelationshipTypeId === relType.relationship_type_id ? "outline" : "secondary"} className="text-xs">
                    {relType.cardinality.replace(/_/g, '-')}
                  </Badge>
                  {selectedRelationshipTypeId === relType.relationship_type_id && (
                    <Badge variant="outline" className="text-xs pointer-events-none">
                      {attributes.length} attr{attributes.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {selectedRelationshipType ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedRelationshipType.display_label}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <span>{selectedRelationshipType.source_entity_kind}</span>
                  <ArrowRight className="w-4 h-4" />
                  <span>{selectedRelationshipType.target_entity_kind}</span>
                  <Badge variant="secondary" className="ml-2">
                    {selectedRelationshipType.cardinality.replace(/_/g, '-')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {attributes.length} attribute{attributes.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button size="sm" onClick={() => setView('create')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Attribute
              </Button>
            </div>

            {selectedRelationshipType.description && (
              <div className="text-sm text-muted-foreground border-l-2 pl-3">
                {selectedRelationshipType.description}
              </div>
            )}

            {attributes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg">
                <p>No attributes defined yet.</p>
                <p className="text-sm mt-2">Click "Add Attribute" to create one.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {attributes.map((attribute) => (
                  <div
                    key={attribute.attribute_id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{attribute.display_label}</h4>
                          <Badge variant="outline">{attribute.attribute_name}</Badge>
                          <Badge>{attribute.data_type}</Badge>
                          {attribute.is_required && <Badge variant="secondary">Required</Badge>}
                        </div>
                        {attribute.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {attribute.description}
                          </p>
                        )}
                        {attribute.default_value && (
                          <div className="text-xs text-muted-foreground">
                            Default: <code className="bg-muted px-1 rounded">{attribute.default_value}</code>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(attribute.attribute_id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a relationship type to view and manage its attributes
          </div>
        )}
      </div>
    </div>
  );
}
