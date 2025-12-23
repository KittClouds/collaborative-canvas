import { useState, useEffect } from 'react';
import { useBlueprintHubContext } from '../context/BlueprintHubContext';
import { useMOCs } from '../hooks/useMOCs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';

interface MocsTabProps {
  isLoading: boolean;
}

export function MocsTab({ isLoading: contextLoading }: MocsTabProps) {
  const { versionId } = useBlueprintHubContext();
  const { mocs, isLoading: hookLoading, create, remove } = useMOCs(versionId);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [formData, setFormData] = useState({
    moc_name: '',
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
    if (!formData.moc_name) {
      return;
    }

    try {
      await create({
        moc_name: formData.moc_name,
        entity_kinds: [],
        description: formData.description || undefined,
      });

      setFormData({
        moc_name: '',
        description: '',
      });
      setView('list');
    } catch (err) {
      console.error('Failed to create MOC:', err);
    }
  };

  const handleDelete = async (mocId: string) => {
    if (confirm('Are you sure you want to delete this MOC?')) {
      try {
        await remove(mocId);
      } catch (err) {
        console.error('Failed to delete MOC:', err);
      }
    }
  };

  if (isLoading && mocs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading MOCs...</div>
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
            <h3 className="text-lg font-semibold">Create MOC</h3>
            <p className="text-sm text-muted-foreground">
              Define a new Map of Content for organizing entities.
            </p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="moc_name">MOC Name</Label>
            <Input
              id="moc_name"
              value={formData.moc_name}
              onChange={(e) => setFormData({ ...formData, moc_name: e.target.value })}
              placeholder="e.g., World Index"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the purpose of this MOC"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setView('list')}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.moc_name}
            >
              Create MOC
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Maps of Content (MOCs)</h3>
        <Button size="sm" onClick={() => setView('create')}>
          <Plus className="w-4 h-4 mr-2" />
          Create MOC
        </Button>
      </div>

      {mocs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No MOCs defined yet.</p>
          <p className="text-sm mt-2">Click "Create MOC" to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {mocs.map((moc) => (
            <div
              key={moc.moc_id}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold">{moc.moc_name}</h4>
                    {moc.entity_kinds.length > 0 && (
                      <Badge variant="secondary">
                        {moc.entity_kinds.length} entity kind{moc.entity_kinds.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  {moc.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {moc.description}
                    </p>
                  )}
                  {moc.entity_kinds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {moc.entity_kinds.map((kind) => (
                        <Badge key={kind} variant="outline" className="text-xs">
                          {kind}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(moc.moc_id)}
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
