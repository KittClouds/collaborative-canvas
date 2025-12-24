import { useState, useEffect } from 'react';
import { useBlueprintHubContext } from '../../context/BlueprintHubContext';
import { useExtractionProfile } from '../../hooks/useExtractionProfile';
import { useRelationshipPatterns } from '../../hooks/useRelationshipPatterns';
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

import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowLeft, RotateCcw } from 'lucide-react';
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

  const [view, setView] = useState<'list' | 'createMapping' | 'createIgnore' | 'createPattern'>('list');

  const [mappingForm, setMappingForm] = useState({
    ner_label: '',
    target_entity_kinds: '',
    priority: 0,
  });

  const [ignoreForm, setIgnoreForm] = useState({
    surface_form: '',
    ner_label: '',
  });

  const [patternForm, setPatternForm] = useState({
    verb_pattern: '',
    relationship_type: '',
    inverse_type: '',
    confidence: 0.7,
    category: 'custom',
    bidirectional: false,
  });

  const {
    patterns,
    isLoading: patternsLoading,
    addPattern,
    removePattern,
    togglePattern,
    resetToDefaults,
  } = useRelationshipPatterns(profile?.profile_id);

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
      await updateProfile({ resolution_policy: value as 'entity_on_accept' | 'mention_first' });
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
      setView('list');
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
      setView('list');
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

  if (view === 'createMapping') {
    return (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-200 p-4">
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
            <h3 className="text-lg font-semibold">Add Label Mapping</h3>
            <p className="text-sm text-muted-foreground">
              Map a NER label to target entity kinds.
            </p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="ner_label">NER Label</Label>
            <Input
              id="ner_label"
              value={mappingForm.ner_label}
              onChange={(e) => setMappingForm({ ...mappingForm, ner_label: e.target.value })}
              placeholder="e.g., PER, ORG, LOC"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_kinds">Target Entity Kinds (comma-separated)</Label>
            <Input
              id="target_kinds"
              value={mappingForm.target_entity_kinds}
              onChange={(e) => setMappingForm({ ...mappingForm, target_entity_kinds: e.target.value })}
              placeholder="e.g., CHARACTER, NPC"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority (Higher numbers resolved first)</Label>
            <Input
              id="priority"
              type="number"
              value={mappingForm.priority}
              onChange={(e) => setMappingForm({ ...mappingForm, priority: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setView('list')}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMapping}
              disabled={!mappingForm.ner_label || !mappingForm.target_entity_kinds}
            >
              Add Mapping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'createIgnore') {
    return (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-200 p-4">
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
            <h3 className="text-lg font-semibold">Add to Ignore List</h3>
            <p className="text-sm text-muted-foreground">
              Prevent specific terms or labels from being extracted.
            </p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="ignore_surface_form">Surface Form (optional)</Label>
            <Input
              id="ignore_surface_form"
              value={ignoreForm.surface_form}
              onChange={(e) => setIgnoreForm({ ...ignoreForm, surface_form: e.target.value })}
              placeholder="e.g., 'the', 'is'"
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

          <p className="text-xs text-muted-foreground italic">
            At least one of the fields above must be specified.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setView('list')}>
              Cancel
            </Button>
            <Button
              onClick={handleAddIgnore}
              disabled={!ignoreForm.surface_form && !ignoreForm.ner_label}
            >
              Add to Ignore List
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'createPattern') {
    const handleAddPattern = async () => {
      if (!patternForm.verb_pattern || !patternForm.relationship_type) return;
      await addPattern({
        verb_pattern: patternForm.verb_pattern,
        relationship_type: patternForm.relationship_type,
        inverse_type: patternForm.inverse_type || undefined,
        confidence: patternForm.confidence,
        category: patternForm.category,
        bidirectional: patternForm.bidirectional,
      });
      setPatternForm({
        verb_pattern: '',
        relationship_type: '',
        inverse_type: '',
        confidence: 0.7,
        category: 'custom',
        bidirectional: false,
      });
      setView('list');
    };

    return (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-200 p-4">
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
            <h3 className="text-lg font-semibold">Add Relationship Pattern</h3>
            <p className="text-sm text-muted-foreground">
              Define a verb pattern for automatic relationship extraction.
            </p>
          </div>
        </div>

        <div className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="verb_pattern">Verb Pattern (regex)</Label>
            <Input
              id="verb_pattern"
              value={patternForm.verb_pattern}
              onChange={(e) => setPatternForm({ ...patternForm, verb_pattern: e.target.value })}
              placeholder="e.g., met|knows|befriended"
            />
            <p className="text-xs text-muted-foreground">
              Use pipe (|) to separate alternatives. Matched between entity mentions.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="relationship_type">Relationship Type</Label>
              <Input
                id="relationship_type"
                value={patternForm.relationship_type}
                onChange={(e) => setPatternForm({ ...patternForm, relationship_type: e.target.value })}
                placeholder="e.g., KNOWS"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inverse_type">Inverse Type (optional)</Label>
              <Input
                id="inverse_type"
                value={patternForm.inverse_type}
                onChange={(e) => setPatternForm({ ...patternForm, inverse_type: e.target.value })}
                placeholder="e.g., KNOWN_BY"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Confidence: {patternForm.confidence.toFixed(2)}</Label>
            <Slider
              min={0.1}
              max={1}
              step={0.05}
              value={[patternForm.confidence]}
              onValueChange={([v]) => setPatternForm({ ...patternForm, confidence: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={patternForm.category}
                onValueChange={(v) => setPatternForm({ ...patternForm, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="spatial">Spatial</SelectItem>
                  <SelectItem value="possession">Possession</SelectItem>
                  <SelectItem value="organizational">Organizational</SelectItem>
                  <SelectItem value="familial">Familial</SelectItem>
                  <SelectItem value="creation">Creation</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                id="bidirectional"
                checked={patternForm.bidirectional}
                onCheckedChange={(v) => setPatternForm({ ...patternForm, bidirectional: v })}
              />
              <Label htmlFor="bidirectional">Bidirectional</Label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setView('list')}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPattern}
              disabled={!patternForm.verb_pattern || !patternForm.relationship_type}
            >
              Add Pattern
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 animate-in fade-in duration-200">
      {/* NER Configuration */}
      <div className="space-y-4 border rounded-lg p-4 bg-card shadow-sm">
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
              <RadioGroupItem value="entity_on_accept" id="entity_on_accept" />
              <Label htmlFor="entity_on_accept" className="font-normal cursor-pointer">
                Create entity on accept (automatic, skips mention step)
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Label Mappings */}
      <div className="space-y-4 border rounded-lg p-4 bg-card shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Label Mappings</h3>
          <Button size="sm" onClick={() => setView('createMapping')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Mapping
          </Button>
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
      <div className="space-y-4 border rounded-lg p-4 bg-card shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ignore List</h3>
          <Button size="sm" onClick={() => setView('createIgnore')}>
            <Plus className="w-4 h-4 mr-2" />
            Add to Ignore
          </Button>
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

      {/* Relationship Patterns */}
      <div className="space-y-4 border rounded-lg p-4 bg-card shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Relationship Patterns</h3>
            <p className="text-xs text-muted-foreground">
              Verb patterns to infer relationships between extracted entities
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={resetToDefaults}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button size="sm" onClick={() => setView('createPattern')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Pattern
            </Button>
          </div>
        </div>

        <div className="border rounded-md max-h-[400px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="text-left p-2">Pattern</th>
                <th className="text-left p-2">Relationship</th>
                <th className="text-left p-2">Category</th>
                <th className="text-center p-2">Confidence</th>
                <th className="text-center p-2">Enabled</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patterns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-4 text-muted-foreground">
                    No relationship patterns defined
                  </td>
                </tr>
              ) : (
                patterns.map((pattern) => (
                  <tr key={pattern.pattern_id} className="border-t">
                    <td className="p-2">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {pattern.verb_pattern}
                      </code>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary">{pattern.relationship_type}</Badge>
                        {pattern.inverse_type && (
                          <span className="text-xs text-muted-foreground">
                            ↔ {pattern.inverse_type}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">{pattern.category}</Badge>
                    </td>
                    <td className="p-2 text-center">
                      <span className="text-sm">{(pattern.confidence * 100).toFixed(0)}%</span>
                    </td>
                    <td className="p-2 text-center">
                      <Switch
                        checked={pattern.enabled}
                        onCheckedChange={() => togglePattern(pattern.pattern_id)}
                      />
                    </td>
                    <td className="p-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removePattern(pattern.pattern_id)}
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
