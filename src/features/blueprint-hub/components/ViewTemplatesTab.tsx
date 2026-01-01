import { useState, useEffect } from 'react';
import { useBlueprintHubContext } from '../context/BlueprintHubContext';
import { useViewTemplates } from '../hooks/useViewTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { ENTITY_KINDS } from '@/lib/types/entityTypes';

interface ViewTemplatesTabProps {
  isLoading: boolean;
}

export function ViewTemplatesTab({ isLoading: contextLoading }: ViewTemplatesTabProps) {
  const { versionId } = useBlueprintHubContext();
  const { viewTemplates, isLoading: hookLoading, create, remove } = useViewTemplates(versionId);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [formData, setFormData] = useState({
    view_name: '',
    view_type: '' as 'table' | 'card' | 'form' | 'kanban' | 'timeline' | 'graph' | 'custom' | '',
    entity_kind: '',
    description: '',
  });

  const isLoading = contextLoading || hookLoading;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && view !== 'list') {
        setView('list');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view]);

  const handleCreate = async () => {
    if (!formData.view_name || !formData.view_type) {
      return;
    }

    try {
      await create({
        view_name: formData.view_name,
        view_type: formData.view_type,
        entity_kind: formData.entity_kind || undefined,
        description: formData.description || undefined,
        is_default: false,
      });

      setFormData({
        view_name: '',
        view_type: '',
        entity_kind: '',
        description: '',
      });
      setView('list');
    } catch (err) {
      console.error('Failed to create view template:', err);
    }
  };

  const handleDelete = async (viewId: string) => {
    if (confirm('Are you sure you want to delete this view template?')) {
      try {
        await remove(viewId);
      } catch (err) {
        console.error('Failed to delete view template:', err);
      }
    }
  };

  if (isLoading && viewTemplates.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading view templates...</div>
      </div>
    );
  }

  if (view === 'create') {
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
            <h3 className="text-lg font-semibold">Create View Template</h3>
            <p className="text-sm text-muted-foreground">
              Define a new view template for displaying entities.
            </p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="view_name">View Name</Label>
            <Input
              id="view_name"
              value={formData.view_name}
              onChange={(e) => setFormData({ ...formData, view_name: e.target.value })}
              placeholder="e.g., Character Table"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="view_type">View Type</Label>
            <Select
              value={formData.view_type}
              onValueChange={(value) => setFormData({ ...formData, view_type: value as typeof formData.view_type })}
            >
              <SelectTrigger id="view_type">
                <SelectValue placeholder="Select view type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="form">Form</SelectItem>
                <SelectItem value="kanban">Kanban</SelectItem>
                <SelectItem value="timeline">Timeline</SelectItem>
                <SelectItem value="graph">Graph</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entity_kind">Entity Kind (Optional)</Label>
            <Select
              value={formData.entity_kind}
              onValueChange={(value) => setFormData({ ...formData, entity_kind: value })}
            >
              <SelectTrigger id="entity_kind">
                <SelectValue placeholder="Select entity kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Entities</SelectItem>
                {ENTITY_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {kind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setView('list')}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.view_name || !formData.view_type}
            >
              Create View Template
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">View Templates</h3>
        <Button size="sm" onClick={() => setView('create')}>
          <Plus className="w-4 h-4 mr-2" />
          Create View Template
        </Button>
      </div>

      {viewTemplates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No view templates defined yet.</p>
          <p className="text-sm mt-2">Click "Create View Template" to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {viewTemplates.map((template) => (
            <div
              key={template.view_id}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold">{template.view_name}</h4>
                    <Badge variant="secondary">{template.view_type}</Badge>
                    {template.entity_kind && (
                      <Badge variant="outline">{template.entity_kind}</Badge>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(template.view_id)}
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
