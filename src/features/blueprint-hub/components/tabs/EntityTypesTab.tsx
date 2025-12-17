import { useState, useRef, useEffect } from 'react';
import { useBlueprintHubContext } from '../../context/BlueprintHubContext';
import { useEntityTypes } from '../../hooks/useEntityTypes';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { ENTITY_KINDS, ENTITY_COLORS } from '@/lib/entities/entityTypes';
import { cn } from '@/lib/utils';

interface EntityTypesTabProps {
  isLoading: boolean;
}

const formatEntityKind = (value: string): string => {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
};

export function EntityTypesTab({ isLoading: contextLoading }: EntityTypesTabProps) {
  const { versionId } = useBlueprintHubContext();
  const { entityTypes, isLoading: hookLoading, create, remove } = useEntityTypes(versionId);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showKindSuggestions, setShowKindSuggestions] = useState(false);
  const kindInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    entity_kind: '',
    display_name: '',
    color: '',
    description: '',
  });

  const isLoading = contextLoading || hookLoading;

  const existingKinds = entityTypes.map(et => et.entity_kind);
  const allSuggestions = [...new Set([...ENTITY_KINDS, ...existingKinds])];
  const filteredSuggestions = formData.entity_kind
    ? allSuggestions.filter(kind => 
        kind.toLowerCase().includes(formData.entity_kind.toLowerCase()) &&
        kind !== formData.entity_kind
      )
    : allSuggestions;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        kindInputRef.current &&
        !kindInputRef.current.contains(event.target as Node)
      ) {
        setShowKindSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKindChange = (value: string) => {
    const formatted = formatEntityKind(value);
    const color = ENTITY_COLORS[formatted as keyof typeof ENTITY_COLORS] || formData.color;
    setFormData({ ...formData, entity_kind: formatted, color });
  };

  const selectKindSuggestion = (kind: string) => {
    const color = ENTITY_COLORS[kind as keyof typeof ENTITY_COLORS] || '';
    setFormData({ ...formData, entity_kind: kind, color });
    setShowKindSuggestions(false);
  };

  const handleCreate = async () => {
    if (!formData.entity_kind || !formData.display_name) {
      return;
    }

    try {
      await create({
        entity_kind: formData.entity_kind,
        display_name: formData.display_name,
        color: formData.color || undefined,
        description: formData.description || undefined,
        is_abstract: false,
      });

      // Reset form
      setFormData({
        entity_kind: '',
        display_name: '',
        color: '',
        description: '',
      });
      setIsCreateDialogOpen(false);
    } catch (err) {
      console.error('Failed to create entity type:', err);
    }
  };

  const handleDelete = async (entityTypeId: string) => {
    if (confirm('Are you sure you want to delete this entity type? This will also delete all associated fields.')) {
      try {
        await remove(entityTypeId);
      } catch (err) {
        console.error('Failed to delete entity type:', err);
      }
    }
  };

  if (isLoading && entityTypes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading entity types...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Entity Types</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Entity Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Entity Type</DialogTitle>
              <DialogDescription>
                Define a new entity type for your blueprint.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="entity_kind">Entity Kind</Label>
                <p className="text-xs text-muted-foreground">
                  Choose from suggestions or type a custom kind (auto-formatted to UPPER_SNAKE_CASE)
                </p>
                <div className="relative">
                  <div className="relative">
                    <Input
                      ref={kindInputRef}
                      id="entity_kind"
                      value={formData.entity_kind}
                      onChange={(e) => handleKindChange(e.target.value)}
                      onFocus={() => setShowKindSuggestions(true)}
                      placeholder="e.g., CHARACTER, SPELL, PROPHECY..."
                      className="pr-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                      onClick={() => setShowKindSuggestions(!showKindSuggestions)}
                    >
                      <ChevronDown className={cn("w-4 h-4 transition-transform", showKindSuggestions && "rotate-180")} />
                    </Button>
                  </div>
                  {showKindSuggestions && filteredSuggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-50 w-full mt-1 max-h-48 overflow-auto rounded-md border bg-popover p-1 shadow-md"
                    >
                      {filteredSuggestions.map((kind) => (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => selectKindSuggestion(kind)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground",
                            existingKinds.includes(kind) && "text-muted-foreground"
                          )}
                        >
                          <span>{kind}</span>
                          {existingKinds.includes(kind) && (
                            <span className="ml-2 text-xs text-muted-foreground">(already defined)</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="e.g., Main Character"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#8b5cf6"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={!formData.entity_kind || !formData.display_name}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {entityTypes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No entity types defined yet.</p>
          <p className="text-sm mt-2">Click "Create Entity Type" to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {entityTypes.map((entityType) => (
            <div
              key={entityType.entity_type_id}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: entityType.color || '#8b5cf6' }}
                    />
                    <h4 className="font-semibold">{entityType.display_name}</h4>
                    <Badge variant="secondary">{entityType.entity_kind}</Badge>
                  </div>
                  {entityType.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {entityType.description}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {entityType.fields.length} field{entityType.fields.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(entityType.entity_type_id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
