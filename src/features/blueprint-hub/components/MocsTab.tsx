import { useState } from 'react';
import { useBlueprintHubContext } from '../context/BlueprintHubContext';
import { useMOCs } from '../hooks/useMOCs';
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
import { Plus, Trash2 } from 'lucide-react';

interface MocsTabProps {
  isLoading: boolean;
}

export function MocsTab({ isLoading: contextLoading }: MocsTabProps) {
  const { versionId } = useBlueprintHubContext();
  const { mocs, isLoading: hookLoading, create, remove } = useMOCs(versionId);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    moc_name: '',
    description: '',
  });

  const isLoading = contextLoading || hookLoading;

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
      setIsCreateDialogOpen(false);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Maps of Content (MOCs)</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Create MOC
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create MOC</DialogTitle>
              <DialogDescription>
                Define a new Map of Content for organizing entities.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={!formData.moc_name}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
