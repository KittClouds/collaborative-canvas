import { useState } from 'react';
import { useBlueprintHubContext } from '../../context/BlueprintHubContext';
import { useRelationshipTypes } from '../../hooks/useRelationshipTypes';
import { useEntityTypes } from '../../hooks/useEntityTypes';
import { RelationshipPreview } from '../previews/RelationshipPreview';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import type { RelationshipDirection } from '../types';

interface RelationshipTypesTabProps {
  isLoading: boolean;
}

export function RelationshipTypesTab({ isLoading: contextLoading }: RelationshipTypesTabProps) {
  const { versionId } = useBlueprintHubContext();
  const { relationshipTypes, isLoading: hookLoading, create, remove } = useRelationshipTypes(versionId);
  const { entityTypes } = useEntityTypes(versionId);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    relationship_name: '',
    display_label: '',
    source_entity_kind: '',
    target_entity_kind: '',
    direction: 'directed' as RelationshipDirection,
    inverse_label: '',
    description: '',
  });

  const isLoading = contextLoading || hookLoading;

  // Get entity type for preview
  const sourceEntityType = entityTypes.find(et => et.entity_kind === formData.source_entity_kind);
  const targetEntityType = entityTypes.find(et => et.entity_kind === formData.target_entity_kind);

  const handleCreate = async () => {
    if (!formData.relationship_name || !formData.display_label || !formData.source_entity_kind || !formData.target_entity_kind) {
      return;
    }

    try {
      await create({
        relationship_name: formData.relationship_name,
        display_label: formData.display_label,
        source_entity_kind: formData.source_entity_kind,
        target_entity_kind: formData.target_entity_kind,
        direction: formData.direction,
        inverse_label: formData.inverse_label || undefined,
        description: formData.description || undefined,
      });

      // Reset form
      setFormData({
        relationship_name: '',
        display_label: '',
        source_entity_kind: '',
        target_entity_kind: '',
        direction: 'directed',
        inverse_label: '',
        description: '',
      });
      setIsCreateDialogOpen(false);
    } catch (err) {
      console.error('Failed to create relationship type:', err);
    }
  };

  const handleDelete = async (relationshipTypeId: string) => {
    if (confirm('Are you sure you want to delete this relationship type? This will also delete all associated attributes.')) {
      try {
        await remove(relationshipTypeId);
      } catch (err) {
        console.error('Failed to delete relationship type:', err);
      }
    }
  };

  if (isLoading && relationshipTypes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading relationship types...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Relationship Types</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Relationship Type
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Relationship Type</DialogTitle>
              <DialogDescription>
                Define a new relationship type between entity types.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="relationship_name">Relationship Name (Key)</Label>
                  <Input
                    id="relationship_name"
                    value={formData.relationship_name}
                    onChange={(e) => setFormData({ ...formData, relationship_name: e.target.value })}
                    placeholder="e.g., character_belongs_to_faction"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_label">Display Label</Label>
                  <Input
                    id="display_label"
                    value={formData.display_label}
                    onChange={(e) => setFormData({ ...formData, display_label: e.target.value })}
                    placeholder="e.g., belongs to"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source_entity_kind">From Type</Label>
                  <Select
                    value={formData.source_entity_kind}
                    onValueChange={(value) => setFormData({ ...formData, source_entity_kind: value })}
                  >
                    <SelectTrigger id="source_entity_kind">
                      <SelectValue placeholder="Select source type" />
                    </SelectTrigger>
                    <SelectContent>
                      {entityTypes.map((et) => (
                        <SelectItem key={et.entity_type_id} value={et.entity_kind}>
                          {et.display_name} ({et.entity_kind})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target_entity_kind">To Type</Label>
                  <Select
                    value={formData.target_entity_kind}
                    onValueChange={(value) => setFormData({ ...formData, target_entity_kind: value })}
                  >
                    <SelectTrigger id="target_entity_kind">
                      <SelectValue placeholder="Select target type" />
                    </SelectTrigger>
                    <SelectContent>
                      {entityTypes.map((et) => (
                        <SelectItem key={et.entity_type_id} value={et.entity_kind}>
                          {et.display_name} ({et.entity_kind})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="direction">Direction</Label>
                <Select
                  value={formData.direction}
                  onValueChange={(value) => setFormData({ ...formData, direction: value as RelationshipDirection })}
                >
                  <SelectTrigger id="direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="directed">Directed (one-way)</SelectItem>
                    <SelectItem value="bidirectional">Bidirectional (two-way)</SelectItem>
                    <SelectItem value="undirected">Undirected (symmetric)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.direction === 'bidirectional' && (
                <div className="space-y-2">
                  <Label htmlFor="inverse_label">Inverse Label (Optional)</Label>
                  <Input
                    id="inverse_label"
                    value={formData.inverse_label}
                    onChange={(e) => setFormData({ ...formData, inverse_label: e.target.value })}
                    placeholder="e.g., has member"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description"
                />
              </div>

              {/* Live Preview */}
              {formData.source_entity_kind && formData.target_entity_kind && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <RelationshipPreview
                    fromType={{
                      display_name: sourceEntityType?.display_name || formData.source_entity_kind,
                      color: sourceEntityType?.color,
                    }}
                    toType={{
                      display_name: targetEntityType?.display_name || formData.target_entity_kind,
                      color: targetEntityType?.color,
                    }}
                    relationship={{
                      direction: formData.direction,
                      display_label: formData.display_label || 'relates to',
                      inverse_label: formData.inverse_label,
                    }}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={
                  !formData.relationship_name || 
                  !formData.display_label || 
                  !formData.source_entity_kind || 
                  !formData.target_entity_kind
                }
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {relationshipTypes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No relationship types defined yet.</p>
          <p className="text-sm mt-2">Click "Create Relationship Type" to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {relationshipTypes.map((relType) => {
            const sourceType = entityTypes.find(et => et.entity_kind === relType.source_entity_kind);
            const targetType = entityTypes.find(et => et.entity_kind === relType.target_entity_kind);

            return (
              <div
                key={relType.relationship_type_id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{relType.display_label}</h4>
                      <Badge variant="outline" className="text-xs">
                        {relType.direction}
                      </Badge>
                    </div>
                    {relType.description && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {relType.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium" style={{ color: sourceType?.color }}>
                        {relType.source_entity_kind}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium" style={{ color: targetType?.color }}>
                        {relType.target_entity_kind}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {relType.attributes.length} attribute{relType.attributes.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(relType.relationship_type_id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
