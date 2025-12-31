import { useState, useEffect } from 'react';
import { useBlueprintHubContext } from '../../context/BlueprintHubContext';
import { useEntityTypes } from '../../hooks/useEntityTypes';
import { useFields } from '../../hooks/useFields';
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
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import type { FieldDataType } from '../../types';

const FIELD_DATA_TYPES: FieldDataType[] = [
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'text',
  'json',
  'uuid',
  'enum',
  'reference',
];

interface FieldsTabProps {
  isLoading: boolean;
}

export function FieldsTab({ isLoading: contextLoading }: FieldsTabProps) {
  const { versionId } = useBlueprintHubContext();
  const { entityTypes, isLoading: entityTypesLoading } = useEntityTypes(versionId);
  const { fields, isLoading: fieldsLoading, create, remove, getFieldsByEntityType } = useFields(versionId);

  const [selectedEntityTypeId, setSelectedEntityTypeId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [formData, setFormData] = useState({
    field_name: '',
    display_label: '',
    data_type: '' as FieldDataType | '',
    is_required: false,
    is_array: false,
    description: '',
    default_value: '',
  });

  const isLoading = contextLoading || entityTypesLoading || fieldsLoading;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && view !== 'list') {
        setView('list');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view]);

  const selectedEntityType = entityTypes.find(et => et.entity_type_id === selectedEntityTypeId);
  const displayedFields = selectedEntityTypeId
    ? getFieldsByEntityType(selectedEntityTypeId)
    : [];

  const handleCreate = async () => {
    if (!selectedEntityTypeId || !formData.field_name || !formData.display_label || !formData.data_type) {
      return;
    }

    try {
      await create({
        entity_type_id: selectedEntityTypeId,
        field_name: formData.field_name,
        display_label: formData.display_label,
        data_type: formData.data_type as FieldDataType,
        is_required: formData.is_required,
        is_array: formData.is_array,
        description: formData.description || undefined,
        default_value: formData.default_value || undefined,
        display_order: displayedFields.length,
      });

      setFormData({
        field_name: '',
        display_label: '',
        data_type: '',
        is_required: false,
        is_array: false,
        description: '',
        default_value: '',
      });
      setView('list');
    } catch (err) {
      console.error('Failed to create field:', err);
    }
  };

  const handleDelete = async (fieldId: string) => {
    if (confirm('Are you sure you want to delete this field?')) {
      try {
        await remove(fieldId);
      } catch (err) {
        console.error('Failed to delete field:', err);
      }
    }
  };

  if (isLoading && entityTypes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading fields...</div>
      </div>
    );
  }

  if (entityTypes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <p>No entity types defined yet.</p>
          <p className="text-sm mt-2">Create an entity type first in the Entity Types tab.</p>
        </div>
      </div>
    );
  }

  if (view === 'create' && selectedEntityType) {
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
            <h3 className="text-lg font-semibold">Add Field to {selectedEntityType.display_name}</h3>
            <p className="text-sm text-muted-foreground">
              Define a new field for this entity type.
            </p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="field_name">Field Name (camelCase)</Label>
            <Input
              id="field_name"
              value={formData.field_name}
              onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
              placeholder="e.g., characterName"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_label">Display Label</Label>
            <Input
              id="display_label"
              value={formData.display_label}
              onChange={(e) => setFormData({ ...formData, display_label: e.target.value })}
              placeholder="e.g., Character Name"
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
                {FIELD_DATA_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_required"
                checked={formData.is_required}
                onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked === true })}
              />
              <Label htmlFor="is_required" className="font-normal cursor-pointer">Required</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_array"
                checked={formData.is_array}
                onCheckedChange={(checked) => setFormData({ ...formData, is_array: checked === true })}
              />
              <Label htmlFor="is_array" className="font-normal cursor-pointer">Array / List</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_value">Default Value (Optional)</Label>
            <Input
              id="default_value"
              value={formData.default_value}
              onChange={(e) => setFormData({ ...formData, default_value: e.target.value })}
              placeholder="Initial value for this field"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Helpful context for this field"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setView('list')}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.field_name || !formData.display_label || !formData.data_type}
            >
              Create Field
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 animate-in fade-in duration-200">
      <div className="w-64 border-r pr-4 space-y-2">
        <h4 className="text-sm font-semibold mb-3 px-3">Entity Types</h4>
        <div className="space-y-1">
          {entityTypes.map((entityType) => (
            <button
              key={entityType.entity_type_id}
              onClick={() => {
                setSelectedEntityTypeId(entityType.entity_type_id);
                setView('list');
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedEntityTypeId === entityType.entity_type_id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entityType.color || '#8b5cf6' }}
                />
                <span className="truncate flex-1">{entityType.display_name}</span>
                <Badge
                  variant={selectedEntityTypeId === entityType.entity_type_id ? "outline" : "secondary"}
                  className="ml-auto pointer-events-none"
                >
                  {getFieldsByEntityType(entityType.entity_type_id).length}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {selectedEntityType ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedEntityType.display_name} Fields</h3>
                <p className="text-sm text-muted-foreground">
                  {displayedFields.length} field{displayedFields.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Button size="sm" onClick={() => setView('create')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </div>

            {displayedFields.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg">
                <p>No fields defined yet.</p>
                <p className="text-sm mt-2">Click "Add Field" to create one.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {displayedFields.map((field) => (
                  <div
                    key={field.field_id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{field.display_label}</h4>
                          <Badge variant="outline">{field.field_name}</Badge>
                          <Badge>{field.data_type}</Badge>
                          {field.is_required && <Badge variant="secondary">Required</Badge>}
                          {field.is_array && <Badge variant="secondary">Array</Badge>}
                        </div>
                        {field.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {field.description}
                          </p>
                        )}
                        {field.default_value && (
                          <div className="text-xs text-muted-foreground">
                            Default: <code className="bg-muted px-1 rounded">{field.default_value}</code>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(field.field_id)}
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
            Select an entity type to view and manage its fields
          </div>
        )}
      </div>
    </div>
  );
}
