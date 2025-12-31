import { useState, useEffect } from 'react';
import { useBlueprintHubContext } from '../../context/BlueprintHubContext';
import { useRelationshipTypes } from '../../hooks/useRelationshipTypes';
import { useEntityTypes } from '../../hooks/useEntityTypes';
import { RelationshipPreview } from '../previews/RelationshipPreview';
import {
  QuickCreateTab,
  BlueprintsTab,
  AdvancedTab,
  RelationshipInstancesDialog,
  type RelationshipPreset,
} from '../relationships';
import type { RelationshipTypeDef } from '../../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, ArrowRight, ArrowLeft, Zap, LayoutGrid, Settings2, Eye, User } from 'lucide-react';
import { useEntitySelectionSafe } from '@/contexts/EntitySelectionContext';
import { relationshipBridgeStore } from '@/lib/relationships/RelationshipBridgeStore';
import type { EntityKind } from '@/lib/entities/entityTypes';
import { ENTITY_COLORS, ENTITY_ICONS } from '@/lib/entities/entityTypes';

interface RelationshipTypesTabProps {
  isLoading: boolean;
}

type ViewMode = 'list' | 'create';

export function RelationshipTypesTab({ isLoading: contextLoading }: RelationshipTypesTabProps) {
  const { versionId } = useBlueprintHubContext();
  const { relationshipTypes, isLoading: hookLoading, create, remove } = useRelationshipTypes(versionId);
  const { entityTypes } = useEntityTypes(versionId);
  const entitySelectionContext = useEntitySelectionSafe();
  const selectedEntity = entitySelectionContext?.selectedEntity ?? null;
  const [view, setView] = useState<ViewMode>('list');
  const [activeTab, setActiveTab] = useState('quick');
  const [presetData, setPresetData] = useState<RelationshipPreset | undefined>(undefined);
  const [instanceCounts, setInstanceCounts] = useState<Map<string, number>>(new Map());
  const [viewInstancesType, setViewInstancesType] = useState<RelationshipTypeDef | null>(null);

  const isLoading = contextLoading || hookLoading;

  // Load instance counts
  useEffect(() => {
    const loadCounts = async () => {
      await relationshipBridgeStore.initialize();
      const counts = await relationshipBridgeStore.getInstanceCountsByType();
      setInstanceCounts(counts);
    };
    loadCounts();
  }, [relationshipTypes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && view === 'create') {
        setView('list');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view]);

  const handleCreate = async (input: Parameters<typeof create>[0]) => {
    await create(input);
    setView('list');
    setPresetData(undefined);
  };

  const handleSelectPreset = (preset: RelationshipPreset, sourceEntity?: { id: string; name: string; kind: EntityKind }) => {
    setPresetData(preset);
    setActiveTab('quick');
    // If sourceEntity is provided, we could pre-populate a relationship creation flow
    // For now, we just set the preset data
  };

  const handleOpenCreate = () => {
    setPresetData(undefined);
    setActiveTab('quick');
    setView('create');
  };

  const handleBack = () => {
    setView('list');
    setPresetData(undefined);
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

  if (view === 'create') {
    return (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h3 className="text-lg font-semibold">Create Relationship Type</h3>
            <p className="text-sm text-muted-foreground">
              Define how entities connect to each other.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="quick" className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              Quick
            </TabsTrigger>
            <TabsTrigger value="blueprints" className="flex items-center gap-1.5">
              <LayoutGrid className="w-4 h-4" />
              Blueprints
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-1.5">
              <Settings2 className="w-4 h-4" />
              Advanced
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="mt-0">
            <QuickCreateTab
              onCreate={handleCreate}
              onCancel={handleBack}
              initialData={presetData}
              entityTypes={entityTypes}
            />
          </TabsContent>

          <TabsContent value="blueprints" className="mt-0">
            <BlueprintsTab onSelectPreset={handleSelectPreset} />
          </TabsContent>

          <TabsContent value="advanced" className="mt-0">
            <AdvancedTab
              onCreate={handleCreate}
              onCancel={handleBack}
              entityTypes={entityTypes}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Entity awareness header */}
      {selectedEntity && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
          {(() => {
            const EntityIcon = ENTITY_ICONS[selectedEntity.kind as EntityKind] || User;
            return <EntityIcon className="w-4 h-4" style={{ color: ENTITY_COLORS[selectedEntity.kind as EntityKind] }} />;
          })()}
          <span className="text-sm">
            Working with <strong>{selectedEntity.label}</strong>
          </span>
          <Badge variant="outline" className="text-xs ml-auto">
            {selectedEntity.kind}
          </Badge>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Relationship Types</h3>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="w-4 h-4 mr-2" />
          New Relationship
        </Button>
      </div>

      {relationshipTypes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center">
              <ArrowRight className="w-6 h-6" />
            </div>
            <p className="font-medium">No relationship types defined yet.</p>
            <p className="text-sm">
              Define how your entities connect to each other.
            </p>
            <Button size="sm" variant="outline" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Relationship
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {relationshipTypes.map((relType) => {
            const sourceType = entityTypes.find(et => et.entity_kind === relType.source_entity_kind);
            const targetType = entityTypes.find(et => et.entity_kind === relType.target_entity_kind);

            return (
              <div
                key={relType.relationship_type_id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{relType.display_label}</h4>
                      <Badge variant="outline" className="text-xs">
                        {relType.direction}
                      </Badge>
                      {relType.cardinality && (
                        <Badge variant="secondary" className="text-xs">
                          {relType.cardinality.replace(/_/g, ':')}
                        </Badge>
                      )}
                    </div>

                    {relType.description && (
                      <p className="text-sm text-muted-foreground">
                        {relType.description}
                      </p>
                    )}

                    <RelationshipPreview
                      fromType={{
                        display_name: sourceType?.display_name || relType.source_entity_kind,
                        color: sourceType?.color,
                      }}
                      toType={{
                        display_name: targetType?.display_name || relType.target_entity_kind,
                        color: targetType?.color,
                      }}
                      relationship={{
                        direction: relType.direction,
                        display_label: relType.display_label,
                        inverse_label: relType.inverse_label,
                      }}
                    />

                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                        {relType.relationship_name}
                      </span>
                      {relType.attributes.length > 0 && (
                        <span>
                          {relType.attributes.length} attribute{relType.attributes.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {instanceCounts.get(relType.relationship_type_id) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] gap-1 px-2"
                          onClick={() => setViewInstancesType(relType)}
                        >
                          <Eye className="w-3 h-3" />
                          {instanceCounts.get(relType.relationship_type_id)} instance{instanceCounts.get(relType.relationship_type_id) !== 1 ? 's' : ''}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(relType.relationship_type_id)}
                    className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* View Instances Dialog */}
      {viewInstancesType && (
        <RelationshipInstancesDialog
          open={!!viewInstancesType}
          onOpenChange={(open) => !open && setViewInstancesType(null)}
          relationshipType={viewInstancesType}
        />
      )}
    </div>
  );
}
