import { useState, useEffect } from 'react';
import { useBlueprintHub } from '../hooks/useBlueprintHub';
import { useBlueprintHubContext } from '../context/BlueprintHubContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { EntityTypesTab } from './tabs/EntityTypesTab';
import { FieldsTab } from './tabs/FieldsTab';
import { RelationshipTypesTab } from './tabs/RelationshipTypesTab';
import { AttributeBlueprintsTab } from './tabs/AttributeBlueprintsTab';
import { ViewTemplatesTab } from './ViewTemplatesTab';
import { MocsTab } from './MocsTab';
import { ExtractionTab } from './tabs/ExtractionTab';
import { seedStarterBlueprint } from '../api/seedBlueprint';
import { publishVersion, createVersion, getVersionById } from '../api/storage';
import { toast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';
import type { BlueprintVersion } from '../types';

export function BlueprintHub() {
  const { isHubOpen, closeHub, isLoading, refresh } = useBlueprintHub();
  const { versionId, projectId, reloadActiveVersion } = useBlueprintHubContext();
  const [isSeeding, setIsSeeding] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<BlueprintVersion | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const handleSeedBlueprint = async () => {
    if (!versionId) {
      alert('No active version available');
      return;
    }

    if (!confirm('This will add starter entity types, relationships, and fields to your blueprint. Continue?')) {
      return;
    }

    setIsSeeding(true);
    try {
      await seedStarterBlueprint(versionId);
      await refresh();
      alert('Starter blueprint loaded successfully!');
    } catch (error) {
      console.error('Error seeding blueprint:', error);
      alert('Failed to load starter blueprint. Check console for details.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handlePublish = async () => {
    if (!versionId) {
      toast({
        title: 'No active version',
        description: 'No version is currently available to publish.',
        variant: 'destructive',
      });
      return;
    }

    setIsPublishing(true);
    try {
      // 1. Publish current version
      await publishVersion(versionId);
      
      // 2. Create new draft version
      await createVersion({
        blueprint_id: projectId,
        status: 'draft',
        change_summary: 'New draft version',
      });
      
      // 3. Reload active version to switch to new draft
      await reloadActiveVersion();
      
      toast({
        title: 'Version published',
        description: 'Version published successfully! Started new draft.',
      });
    } catch (error) {
      console.error('Error publishing version:', error);
      toast({
        title: 'Publish failed',
        description: error instanceof Error ? error.message : 'Failed to publish version.',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Fetch current version info
  useEffect(() => {
    const loadVersion = async () => {
      if (!versionId) return;
      try {
        const version = await getVersionById(versionId);
        setCurrentVersion(version);
      } catch (error) {
        console.error('Error loading version:', error);
      }
    };

    loadVersion();
  }, [versionId]);

  return (
    <Dialog open={isHubOpen} onOpenChange={(open) => !open && closeHub()}>
      <DialogContent className="max-w-6xl h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Blueprint Hub</DialogTitle>
            <div className="flex items-center gap-3">
              {currentVersion && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    v{currentVersion.version_number}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-md ${
                    currentVersion.status === 'draft' 
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : currentVersion.status === 'published'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}>
                    {currentVersion.status.charAt(0).toUpperCase() + currentVersion.status.slice(1)}
                  </span>
                  {currentVersion.status === 'draft' && (
                    <Button
                      onClick={handlePublish}
                      disabled={isPublishing}
                      size="sm"
                      variant="default"
                    >
                      {isPublishing ? 'Publishing...' : 'Publish'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="entity-types" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="entity-types">Entity Types</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="relationships">Relationships</TabsTrigger>
            <TabsTrigger value="attributes">Attributes</TabsTrigger>
            <TabsTrigger value="views">View Templates</TabsTrigger>
            <TabsTrigger value="mocs">MOCs</TabsTrigger>
            <TabsTrigger value="extraction">Extraction (NER)</TabsTrigger>
            <TabsTrigger value="help">How to Use</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4">
            <TabsContent value="entity-types" className="h-full">
              <EntityTypesTab isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="fields" className="h-full">
              <FieldsTab isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="relationships" className="h-full">
              <RelationshipTypesTab isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="attributes" className="h-full">
              <AttributeBlueprintsTab isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="views" className="h-full">
              <ViewTemplatesTab isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="mocs" className="h-full">
              <MocsTab isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="extraction" className="h-full">
              <ExtractionTab isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="help" className="h-full">
              <div className="space-y-6 p-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Welcome to Blueprint Hub</h3>
                  <p className="text-sm text-muted-foreground">
                    Blueprint Hub lets you define the structure of your knowledge base by creating entity types,
                    fields, relationships, and views.
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Quick Start</h4>
                  
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <h5 className="font-medium mb-1">Load Starter Blueprint</h5>
                        <p className="text-sm text-muted-foreground mb-3">
                          Get started quickly with a pre-configured blueprint including entity types (Note, Character,
                          Location, Item, Faction), relationships, and sample fields.
                        </p>
                        <Button 
                          onClick={handleSeedBlueprint}
                          disabled={isSeeding}
                          size="sm"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          {isSeeding ? 'Loading...' : 'Load Starter Blueprint'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <h5 className="font-medium mb-1">Entity Types</h5>
                      <p className="text-muted-foreground">
                        Define types of entities (e.g., Character, Location, Item) that your knowledge base will contain.
                      </p>
                    </div>
                    
                    <div>
                      <h5 className="font-medium mb-1">Fields</h5>
                      <p className="text-muted-foreground">
                        Add custom fields to entity types to store specific data (e.g., age, role, coordinates).
                      </p>
                    </div>
                    
                    <div>
                      <h5 className="font-medium mb-1">Relationships</h5>
                      <p className="text-muted-foreground">
                        Define how entity types can be connected (e.g., Character LOCATED_IN Location).
                      </p>
                    </div>
                    
                    <div>
                      <h5 className="font-medium mb-1">View Templates</h5>
                      <p className="text-muted-foreground">
                        Create custom views for displaying entities in different formats (table, card, timeline, etc.).
                      </p>
                    </div>
                    
                    <div>
                      <h5 className="font-medium mb-1">MOCs (Maps of Content)</h5>
                      <p className="text-muted-foreground">
                        Organize and group related entities for easy navigation and reference.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
