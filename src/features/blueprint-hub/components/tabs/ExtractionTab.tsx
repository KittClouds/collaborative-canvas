import { useState } from 'react';
import { useBlueprintHubContext } from '../../context/BlueprintHubContext';
import { useExtractionProfile } from '../../hooks/useExtractionProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ExtractionTabProps {
  isLoading: boolean;
}

export function ExtractionTab({ isLoading: contextLoading }: ExtractionTabProps) {
  const { versionId } = useBlueprintHubContext();
  const {
    profile,
    mappings,
    ignoreList,
    isLoading: hookLoading,
    updateProfile,
    addMapping,
    removeMapping,
    addIgnore,
    removeIgnore,
  } = useExtractionProfile(versionId);

  const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
  const [isIgnoreDialogOpen, setIsIgnoreDialogOpen] = useState(false);
  
  const [mappingForm, setMappingForm] = useState({
    ner_label: '',
    target_entity_kinds: '',
    priority: 0,
  });

  const [ignoreForm, setIgnoreForm] = useState({
    surface_form: '',
    ner_label: '',
  });

  const isLoading = contextLoading || hookLoading;

  const handleToggleNER = async (enabled: boolean) => {
    if (!profile) return;
    try {
      await updateProfile({ enabled });
    } catch (err) {
      console.error('Failed to toggle NER:', err);
    }
  };

  const handleConfidenceChange = async (value: number[]) => {
    if (!profile) return;
    try {
      await updateProfile({ confidence_threshold: value[0] });
    } catch (err) {
      console.error('Failed to update confidence threshold:', err);
    }
  };

  const handleResolutionPolicyChange = async (value: string) => {
    if (!profile) return;
    try {
      await updateProfile({ resolution_policy: value as 'create_entity' | 'mention_first' });
    } catch (err) {
      console.error('Failed to update resolution policy:', err);
    }
  };

  const handleAddMapping = async () => {
    if (!mappingForm.ner_label || !mappingForm.target_entity_kinds) return;

    try {
      const entityKinds = mappingForm.target_entity_kinds
        .split(',')
        .map(k => k.trim())
        .filter(Boolean);

      await addMapping({
        ner_label: mappingForm.ner_label,
        target_entity_kinds: entityKinds,
        priority: mappingForm.priority,
      });

      setMappingForm({ ner_label: '', target_entity_kinds: '', priority: 0 });
      setIsMappingDialogOpen(false);
    } catch (err) {
      console.error('Failed to add mapping:', err);
    }
  };

  const handleDeleteMapping = async (mapping_id: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return;

    try {
      await removeMapping(mapping_id);
    } catch (err) {
      console.error('Failed to delete mapping:', err);
    }
  };

  const handleAddIgnore = async () => {
    if (!ignoreForm.surface_form && !ignoreForm.ner_label) return;

    try {
      await addIgnore({
        surface_form: ignoreForm.surface_form || undefined,
        ner_label: ignoreForm.ner_label || undefined,
      });

      setIgnoreForm({ surface_form: '', ner_label: '' });
      setIsIgnoreDialogOpen(false);
    } catch (err) {
      console.error('Failed to add to ignore list:', err);
    }
  };

  const handleDeleteIgnore = async (ignore_id: string) => {
    if (!confirm('Are you sure you want to remove this from the ignore list?')) return;

    try {
      await removeIgnore(ignore_id);
    } catch (err) {
      console.error('Failed to remove from ignore list:', err);
    }
  };

  if (isLoading && !profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading extraction profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">No extraction profile available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* NER Configuration */}
      <div className="space-y-4 border rounded-lg p-4">
        <h3 className="text-lg font-semibold">NER Configuration</h3>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable NER Extraction</Label>
            <p className="text-xs text-muted-foreground">
              Automatically extract entities using Named Entity Recognition
            </p>
          </div>
          <Switch
            checked={profile.enabled}
            onCheckedChange={handleToggleNER}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model_id">Model ID</Label>
          <Input
            id="model_id"
            value={profile.model_id}
            onChange={(e) => updateProfile({ model_id: e.target.value })}
            placeholder="onnx-community/NeuroBERT-NER-ONNX"
          />
          <p className="text-xs text-muted-foreground">
            HuggingFace model identifier for NER extraction
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confidence_threshold">
            Confidence Threshold: {profile.confidence_threshold.toFixed(2)}
          </Label>
          <Slider
            id="confidence_threshold"
            min={0}
            max={1}
            step={0.05}
            value={[profile.confidence_threshold]}
            onValueChange={handleConfidenceChange}
          />
          <p className="text-xs text-muted-foreground">
            Minimum confidence score for entity extraction (0.0 - 1.0)
          </p>
        </div>

        <div className="space-y-2">
          <Label>Resolution Policy</Label>
          <RadioGroup
            value={profile.resolution_policy}
            onValueChange={handleResolutionPolicyChange}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="mention_first" id="mention_first" />
              <Label htmlFor="mention_first" className="font-normal">
                Create mention first (safer, allows review before entity creation)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="create_entity" id="create_entity" />
              <Label htmlFor="create_entity" className="font-normal">
                Create entity on accept (automatic, skips mention step)
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Label Mappings */}
      <div className="space-y-4 border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Label Mappings</h3>
          <Dialog open={isMappingDialogOpen} onOpenChange={setIsMappingDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Mapping
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Label Mapping</DialogTitle>
                <DialogDescription>
                  Map a NER label to target entity kinds
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ner_label">NER Label</Label>
                  <Input
                    id="ner_label"
                    value={mappingForm.ner_label}
                    onChange={(e) => setMappingForm({ ...mappingForm, ner_label: e.target.value })}
                    placeholder="PER, ORG, LOC, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target_kinds">Target Entity Kinds (comma-separated)</Label>
                  <Input
                    id="target_kinds"
                    value={mappingForm.target_entity_kinds}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, target_entity_kinds: e.target.value })
                    }
                    placeholder="CHARACTER, NPC"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={mappingForm.priority}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, priority: parseInt(e.target.value) || 0 })
                    }
                    placeholder="0"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsMappingDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddMapping}>Add Mapping</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="border rounded-md">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">NER Label</th>
                <th className="text-left p-2">Maps To</th>
                <th className="text-left p-2">Priority</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center p-4 text-muted-foreground">
                    No label mappings defined
                  </td>
                </tr>
              ) : (
                mappings.map((mapping) => (
                  <tr key={mapping.mapping_id} className="border-t">
                    <td className="p-2">
                      <Badge variant="outline">{mapping.ner_label}</Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {mapping.target_entity_kinds.map((kind) => (
                          <Badge key={kind} variant="secondary">
                            {kind}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-2">{mapping.priority}</td>
                    <td className="p-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteMapping(mapping.mapping_id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ignore List */}
      <div className="space-y-4 border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ignore List</h3>
          <Dialog open={isIgnoreDialogOpen} onOpenChange={setIsIgnoreDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add to Ignore
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add to Ignore List</DialogTitle>
                <DialogDescription>
                  Ignore specific surface forms or NER labels
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ignore_surface_form">Surface Form (optional)</Label>
                  <Input
                    id="ignore_surface_form"
                    value={ignoreForm.surface_form}
                    onChange={(e) => setIgnoreForm({ ...ignoreForm, surface_form: e.target.value })}
                    placeholder="e.g., 'the'"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ignore_ner_label">NER Label (optional)</Label>
                  <Input
                    id="ignore_ner_label"
                    value={ignoreForm.ner_label}
                    onChange={(e) => setIgnoreForm({ ...ignoreForm, ner_label: e.target.value })}
                    placeholder="e.g., 'MISC'"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  At least one field must be filled
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsIgnoreDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddIgnore}>Add to Ignore</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="border rounded-md">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Surface Form</th>
                <th className="text-left p-2">NER Label</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ignoreList.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center p-4 text-muted-foreground">
                    No ignore entries defined
                  </td>
                </tr>
              ) : (
                ignoreList.map((entry) => (
                  <tr key={entry.ignore_id} className="border-t">
                    <td className="p-2">
                      {entry.surface_form ? (
                        <code className="bg-muted px-1 rounded">{entry.surface_form}</code>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-2">
                      {entry.ner_label ? (
                        <Badge variant="outline">{entry.ner_label}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteIgnore(entry.ignore_id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
