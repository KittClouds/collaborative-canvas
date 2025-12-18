import React, { useState, useCallback, useMemo } from 'react';
import { useBlueprintHub } from '@/features/blueprint-hub/hooks/useBlueprintHub';
import { useBlueprintHubContext } from '@/features/blueprint-hub/context/BlueprintHubContext';
import { useEntityRelationships } from '@/features/blueprint-hub/hooks/useEntityRelationships';
import { useEntities } from '@/features/blueprint-hub/hooks/useEntities';
import { findEntityByName } from '@/lib/cozo/api/entities';
import { createEdge, deleteEdge } from '@/lib/cozo/api/edges';
import type { ParsedEntity, EntityAttributes } from '@/types/factSheetTypes';
import type { CompiledEntityType, FieldDef, ViewTemplateDef, CompiledRelationshipType } from '@/features/blueprint-hub/types';
import type { RenderSection, RenderBlock, LayoutOverrides } from '@/features/blueprint-hub/types/layout';
import { LayoutGrid, AlertTriangle, Settings, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { mergeLayout } from '@/features/blueprint-hub/utils/layoutMerger';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FactSheetCard } from './cards/FactSheetCard';
import { FieldGroupBlock, RelationshipBlock } from './blocks';
import { WidgetBlock } from './blocks/WidgetBlock';
import { validateEntity } from '@/features/blueprint-hub/services/validator';
import { toast } from '@/hooks/use-toast';

interface BlueprintCardsPanelProps {
  entity: ParsedEntity;
  onUpdate: (attributes: EntityAttributes) => void;
}

export function BlueprintCardsPanel({ entity, onUpdate }: BlueprintCardsPanelProps) {
  const { compiledBlueprint, isLoading } = useBlueprintHub();
  const { projectId } = useBlueprintHubContext();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [entityId, setEntityId] = useState<string | null>(null);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Fetch relationships and entities
  const { edges, isLoading: edgesLoading, refresh: refreshEdges } = useEntityRelationships(entityId);
  const { entities: allEntities, isLoading: entitiesLoading } = useEntities(projectId);

  // Resolve entity ID (use noteId if available, otherwise find by name)
  React.useEffect(() => {
    const resolveEntityId = async () => {
      if (entity.noteId) {
        setEntityId(entity.noteId);
      } else {
        try {
          const foundEntity = await findEntityByName(entity.label, projectId, entity.kind);
          if (foundEntity) {
            setEntityId(foundEntity.id);
          } else {
            setEntityId(null);
          }
        } catch (error) {
          console.error('Error resolving entity ID:', error);
          setEntityId(null);
        }
      }
    };

    resolveEntityId();
  }, [entity.noteId, entity.label, entity.kind, projectId]);

  // Find entity type in compiled blueprint
  const entityType = useMemo<CompiledEntityType | null>(() => {
    if (!compiledBlueprint) return null;
    
    return compiledBlueprint.entityTypes.find(
      (et) => et.entity_kind === entity.kind
    ) || null;
  }, [compiledBlueprint, entity.kind]);

  // Compute relevant relationship types for this entity
  const relevantRelationshipTypes = useMemo<CompiledRelationshipType[]>(() => {
    if (!compiledBlueprint || !entityType) return [];

    return compiledBlueprint.relationshipTypes.filter(
      (rt) =>
        rt.source_entity_kind === entityType.entity_kind ||
        rt.target_entity_kind === entityType.entity_kind
    );
  }, [compiledBlueprint, entityType]);

  // Handlers for relationship operations
  const handleAddRelationship = useCallback(
    async (relationshipType: CompiledRelationshipType, targetId: string) => {
      if (!entityId) {
        toast({
          title: 'Error',
          description: 'Entity not resolved. Cannot add relationship.',
          variant: 'destructive',
        });
        return;
      }

      try {
        await createEdge({
          source_id: entityId,
          target_id: targetId,
          group_id: projectId,
          edge_type: relationshipType.relationship_name,
        });

        await refreshEdges();

        toast({
          title: 'Relationship added',
          description: `Added ${relationshipType.display_label} relationship.`,
        });
      } catch (error) {
        console.error('Error adding relationship:', error);
        toast({
          title: 'Error',
          description: 'Failed to add relationship.',
          variant: 'destructive',
        });
      }
    },
    [entityId, projectId, refreshEdges]
  );

  const handleRemoveRelationship = useCallback(
    async (edgeId: string) => {
      try {
        await deleteEdge(edgeId);
        await refreshEdges();

        toast({
          title: 'Relationship removed',
          description: 'Relationship successfully removed.',
        });
      } catch (error) {
        console.error('Error removing relationship:', error);
        toast({
          title: 'Error',
          description: 'Failed to remove relationship.',
          variant: 'destructive',
        });
      }
    },
    [refreshEdges]
  );

  // Generate default layout from entity type fields
  const generateDefaultLayout = useCallback((entityType: CompiledEntityType): RenderSection[] => {
    const groups = new Map<string, FieldDef[]>();
    
    for (const field of entityType.fields) {
      const groupName = field.group_name || 'General';
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(field);
    }

    // Sort fields within each group by display_order
    for (const fields of groups.values()) {
      fields.sort((a, b) => a.display_order - b.display_order);
    }

    // Convert to RenderSection array
    return Array.from(groups.entries()).map(([name, fields]) => ({
      id: `group-${name}`,
      title: name,
      blocks: [
        {
          type: 'field_group',
          id: `fields-${name}`,
          fields,
        } as RenderBlock
      ],
    }));
  }, []);

  // Parse template layout (stub for future template support)
  const parseTemplateLayout = useCallback((
    template: ViewTemplateDef,
    entityType: CompiledEntityType
  ): RenderSection[] | null => {
    // Check if template has structured layout
    // For now, return null to use fallback
    // Future: Parse template.field_layout into RenderSection[]
    return null;
  }, []);

  // Generate demo widgets for CHARACTER entities (temporary)
  const injectDemoWidgets = useCallback((sections: RenderSection[], entityType: CompiledEntityType, entityAttrs: EntityAttributes): RenderSection[] => {
    if (entityType.entity_kind !== 'CHARACTER') {
      return sections;
    }

    // Extract character stats for demo
    const health = entityAttrs.health || 100;
    const mana = entityAttrs.mana || 50;
    const strength = entityAttrs.strength || 10;
    const intelligence = entityAttrs.intelligence || 10;

    // Create demo Status section with widgets
    const demoSection: RenderSection = {
      id: 'demo-status',
      title: 'Status',
      blocks: [
        {
          type: 'widget',
          id: 'widget-progress-xp',
          config: {
            widgetId: 'progress-bar',
            props: {
              label: 'Experience',
              color: '#3b82f6',
            },
            bindings: {
              value: {
                path: 'attributes.xp',
                transform: 'toNumber',
                defaultValue: 0,
              },
              max: {
                path: 'attributes.max_xp',
                transform: 'toNumber',
                defaultValue: 1000,
              },
            },
          },
        } as RenderBlock,
        {
          type: 'widget',
          id: 'widget-stats-grid',
          config: {
            widgetId: 'stats-grid',
            props: {
              columns: 2,
              stats: [
                {
                  label: 'Health',
                  value: health,
                  description: 'Current HP',
                },
                {
                  label: 'Mana',
                  value: mana,
                  description: 'Current MP',
                },
                {
                  label: 'Strength',
                  value: strength,
                  description: 'Physical power',
                },
                {
                  label: 'Intelligence',
                  value: intelligence,
                  description: 'Magical power',
                },
              ],
            },
          },
        } as RenderBlock,
      ],
    };

    // Prepend demo section
    return [demoSection, ...sections];
  }, []);

  // Compute layout from entity type and optional template
  const layout = useMemo<RenderSection[]>(() => {
    if (!entityType) return [];

    let sections: RenderSection[] = [];

    // Try to find and parse view template (stub)
    // In the future, check entityType.defaultViewTemplateId
    const template = null; // Future: compiledBlueprint?.viewTemplates.find(...)
    
    if (template) {
      const parsedLayout = parseTemplateLayout(template, entityType);
      if (parsedLayout) {
        sections = parsedLayout;
      }
    }

    // Fallback to default layout
    if (sections.length === 0) {
      sections = generateDefaultLayout(entityType);
    }

    // Inject demo widgets for CHARACTER entities
    sections = injectDemoWidgets(sections, entityType, entity.attributes);

    // Add relationships section if there are relevant relationship types
    if (relevantRelationshipTypes.length > 0) {
      const relationshipSection: RenderSection = {
        id: 'relationships',
        title: 'Relationships',
        blocks: relevantRelationshipTypes.map((rt) => ({
          type: 'relationship',
          id: `relationship-${rt.relationship_name}`,
          definition: rt,
        } as RenderBlock)),
      };
      sections.push(relationshipSection);
    }

    return sections;
  }, [entityType, entity.attributes, generateDefaultLayout, parseTemplateLayout, injectDemoWidgets, relevantRelationshipTypes]);

  // Get layout overrides from entity attributes
  const overrides = useMemo<LayoutOverrides>(() => {
    return (entity.attributes.__layout_overrides as LayoutOverrides) || {};
  }, [entity.attributes.__layout_overrides]);

  // Compute effective layout by merging base layout with overrides
  const effectiveLayout = useMemo<RenderSection[]>(() => {
    return mergeLayout(layout, overrides);
  }, [layout, overrides]);

  const handleFieldChange = useCallback(
    (fieldName: string, value: any) => {
      const updatedAttributes = {
        ...entity.attributes,
        [fieldName]: value,
      };

      // Validate on change
      if (entityType) {
        const validation = validateEntity(entityType, updatedAttributes);
        setValidationErrors(validation.errors);
      }

      onUpdate(updatedAttributes);
    },
    [entity.attributes, entityType, onUpdate]
  );

  // Helper to update layout overrides
  const updateOverrides = useCallback(
    (newOverrides: LayoutOverrides) => {
      const updatedAttributes = {
        ...entity.attributes,
        __layout_overrides: newOverrides,
      };
      onUpdate(updatedAttributes);
    },
    [entity.attributes, onUpdate]
  );

  // Handler to move section up or down
  const handleMoveSection = useCallback(
    (sectionId: string, direction: 'up' | 'down') => {
      const currentOrder = overrides.sectionOrder || effectiveLayout.map(s => s.id);
      const currentIndex = currentOrder.indexOf(sectionId);
      
      if (currentIndex === -1) return;
      
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      if (newIndex < 0 || newIndex >= currentOrder.length) return;
      
      const newOrder = [...currentOrder];
      [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
      
      updateOverrides({
        ...overrides,
        sectionOrder: newOrder,
      });
    },
    [overrides, effectiveLayout, updateOverrides]
  );

  // Handler to toggle section visibility
  const handleToggleSectionVisibility = useCallback(
    (sectionId: string) => {
      const hiddenSections = overrides.hiddenSections || [];
      const isHidden = hiddenSections.includes(sectionId);
      
      const newHiddenSections = isHidden
        ? hiddenSections.filter(id => id !== sectionId)
        : [...hiddenSections, sectionId];
      
      updateOverrides({
        ...overrides,
        hiddenSections: newHiddenSections,
      });
    },
    [overrides, updateOverrides]
  );

  // Handler to move block within a section
  const handleMoveBlock = useCallback(
    (sectionId: string, blockId: string, direction: 'up' | 'down') => {
      const section = effectiveLayout.find(s => s.id === sectionId);
      if (!section) return;
      
      const sectionOverride = overrides.sections?.[sectionId] || {};
      const currentOrder = sectionOverride.blockOrder || section.blocks.map(b => b.id);
      const currentIndex = currentOrder.indexOf(blockId);
      
      if (currentIndex === -1) return;
      
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      if (newIndex < 0 || newIndex >= currentOrder.length) return;
      
      const newOrder = [...currentOrder];
      [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
      
      updateOverrides({
        ...overrides,
        sections: {
          ...overrides.sections,
          [sectionId]: {
            ...sectionOverride,
            blockOrder: newOrder,
          },
        },
      });
    },
    [overrides, effectiveLayout, updateOverrides]
  );

  // Handler to toggle block visibility with required field check
  const handleToggleBlockVisibility = useCallback(
    (sectionId: string, blockId: string) => {
      // Find the block to check for required fields
      const section = effectiveLayout.find(s => s.id === sectionId);
      const block = section?.blocks.find(b => b.id === blockId);
      
      if (block && block.type === 'field_group') {
        const hasRequiredFields = block.fields.some(f => f.is_required);
        
        if (hasRequiredFields) {
          const sectionOverride = overrides.sections?.[sectionId] || {};
          const isCurrentlyHidden = sectionOverride.hiddenBlocks?.includes(blockId);
          
          if (!isCurrentlyHidden) {
            // Trying to hide a block with required fields
            toast({
              title: 'Cannot hide block',
              description: 'This block contains required fields and cannot be hidden.',
              variant: 'destructive',
            });
            return;
          }
        }
      }
      
      const sectionOverride = overrides.sections?.[sectionId] || {};
      const hiddenBlocks = sectionOverride.hiddenBlocks || [];
      const isHidden = hiddenBlocks.includes(blockId);
      
      const newHiddenBlocks = isHidden
        ? hiddenBlocks.filter(id => id !== blockId)
        : [...hiddenBlocks, blockId];
      
      updateOverrides({
        ...overrides,
        sections: {
          ...overrides.sections,
          [sectionId]: {
            ...sectionOverride,
            hiddenBlocks: newHiddenBlocks,
          },
        },
      });
    },
    [overrides, effectiveLayout, updateOverrides]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <LayoutGrid className="h-12 w-12 text-muted-foreground/50 mb-4 animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading blueprint...</p>
      </div>
    );
  }

  if (!compiledBlueprint) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <LayoutGrid className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">No blueprint available</p>
      </div>
    );
  }

  if (!entityType) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-yellow-500/50 mb-4" />
        <p className="text-sm text-muted-foreground mb-2">
          Entity type not found in blueprint
        </p>
        <p className="text-xs text-muted-foreground/70">
          Kind: <code className="bg-muted px-1 rounded">{entity.kind}</code>
        </p>
      </div>
    );
  }

  if (effectiveLayout.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <LayoutGrid className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">No fields defined for this entity type</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/50">
        <div className="text-sm font-medium text-muted-foreground">
          {entity.label} - {entityType.display_label}
        </div>
        <Button
          variant={isCustomizing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsCustomizing(!isCustomizing)}
        >
          <Settings className="h-4 w-4 mr-2" />
          {isCustomizing ? 'Exit Customization' : 'Customize Layout'}
        </Button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {effectiveLayout.map((section, sectionIndex) => {
          const sectionOverride = overrides.sections?.[section.id];
          
          // Section action buttons for customization mode
          const sectionActions = isCustomizing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => handleMoveSection(section.id, 'up')}
                disabled={sectionIndex === 0}
                title="Move section up"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => handleMoveSection(section.id, 'down')}
                disabled={sectionIndex === effectiveLayout.length - 1}
                title="Move section down"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => handleToggleSectionVisibility(section.id)}
                title="Toggle section visibility"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </>
          ) : null;

          return (
            <FactSheetCard
              key={section.id}
              title={section.title}
              defaultOpen={true}
              actions={sectionActions}
            >
              {section.blocks.map((block, blockIndex) => {
                // Block wrapper for customization mode
                const blockContent = (() => {
                  if (block.type === 'field_group') {
                    return (
                      <FieldGroupBlock
                        key={`${section.id}-${blockIndex}`}
                        fields={block.fields}
                        values={entity.attributes}
                        onChange={handleFieldChange}
                        errors={validationErrors}
                      />
                    );
                  } else if (block.type === 'widget') {
                    return (
                      <WidgetBlock
                        key={`${section.id}-${blockIndex}`}
                        config={block.config}
                        entity={entity}
                      />
                    );
                  } else if (block.type === 'relationship') {
                    if (!entityId || edgesLoading || entitiesLoading) {
                      return (
                        <div key={`${section.id}-${blockIndex}`} className="p-3 text-sm text-muted-foreground">
                          Loading relationships...
                        </div>
                      );
                    }
                    return (
                      <RelationshipBlock
                        key={`${section.id}-${blockIndex}`}
                        definition={block.definition}
                        entityId={entityId}
                        entityKind={entity.kind}
                        edges={edges}
                        allEntities={allEntities}
                        onAdd={(targetId) => handleAddRelationship(block.definition, targetId)}
                        onRemove={handleRemoveRelationship}
                      />
                    );
                  }
                  return null;
                })();

                if (!isCustomizing) {
                  return blockContent;
                }

                // In customization mode, wrap blocks with controls
                const hasRequiredFields = block.type === 'field_group' && block.fields.some(f => f.is_required);
                const isHidden = sectionOverride?.hiddenBlocks?.includes(block.id);

                return (
                  <div key={`${section.id}-${blockIndex}`} className="relative group">
                    {/* Block controls overlay */}
                    <div className="absolute -top-2 -right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 w-6 p-0 shadow-md"
                        onClick={() => handleMoveBlock(section.id, block.id, 'up')}
                        disabled={blockIndex === 0}
                        title="Move block up"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 w-6 p-0 shadow-md"
                        onClick={() => handleMoveBlock(section.id, block.id, 'down')}
                        disabled={blockIndex === section.blocks.length - 1}
                        title="Move block down"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-6 w-6 p-0 shadow-md"
                        onClick={() => handleToggleBlockVisibility(section.id, block.id)}
                        disabled={hasRequiredFields && !isHidden}
                        title={
                          hasRequiredFields && !isHidden
                            ? 'Cannot hide block with required fields'
                            : isHidden
                            ? 'Show block'
                            : 'Hide block'
                        }
                      >
                        {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                    {/* Block content */}
                    <div className={cn(isHidden && 'opacity-50')}>
                      {blockContent}
                    </div>
                  </div>
                );
              })}
            </FactSheetCard>
          );
        })}
      </div>
    </div>
  );
}
