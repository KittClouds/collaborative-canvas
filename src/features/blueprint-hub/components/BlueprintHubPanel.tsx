import { useState, useEffect } from 'react';
import { useBlueprintHub } from '../hooks/useBlueprintHub';
import { useBlueprintHubContext } from '../context/BlueprintHubContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Sparkles, Box, Network, Database, FileCode, Tag, Eye, Play, HelpCircle, Users, Palette } from 'lucide-react';
import { EntityTypesTab } from './tabs/EntityTypesTab';
import { EntityThemeTab } from './tabs/EntityThemeTab';
import { FieldsTab } from './tabs/FieldsTab';
import { RelationshipTypesTab } from './tabs/RelationshipTypesTab';
import { AttributeBlueprintsTab } from './tabs/AttributeBlueprintsTab';
import { NetworksTab } from './tabs/NetworksTab';
import { ViewTemplatesTab } from './ViewTemplatesTab';
import { MocsTab } from './MocsTab';
import { ExtractionTab } from './tabs/ExtractionTab';
import { PatternManager } from './PatternManager';
import { seedStarterBlueprint } from '../api/seedBlueprint';
import { publishVersion, createVersion, getVersionById } from '../api/storage';
import { toast } from '@/hooks/use-toast';
import type { BlueprintVersion } from '../types';
import { cn } from '@/lib/utils';

export function BlueprintHubPanel() {
    const { isHubOpen, closeHub, isLoading, refresh } = useBlueprintHub();
    const { versionId, projectId, reloadActiveVersion } = useBlueprintHubContext();
    const [isSeeding, setIsSeeding] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<BlueprintVersion | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [activeTab, setActiveTab] = useState("entity-types");

    // We use the context's isHubOpen to control the collapsible state
    // But we need a local state to handle the animation/collapsible logic properly
    // or we can just rely on the parent rendering it. 
    // Unlike FooterLinksPanel which is always rendered but collapsed/expanded,
    // BlueprintHub might be conditionally rendered.
    // However, FooterLinksPanel stays mounted. Let's adapt that pattern.
    // actually, if we want it to be a toggle from the sidebar, we should probably 
    // allow it to be closed completely, OR just collapsed.
    // The FooterLinksPanel uses a local isOpen state.
    // The BlueprintHub uses a global isHubOpen state.
    // We should map isHubOpen to the Collapsible open state.

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
            toast({
                title: 'Starter blueprint loaded',
                description: 'Successfully loaded starter entities and relationships.',
            });
        } catch (error) {
            console.error('Error seeding blueprint:', error);
            toast({
                title: 'Seeding failed',
                description: 'Failed to load starter blueprint.',
                variant: 'destructive',
            });
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
    }, [versionId, isPublishing]); // Reload when publishing changes state

    // We keep the component mounted to allow Collapsible to handle the "pop up" animation
    // The fixed positioning keeps it at the bottom.
    // If we return null, it unmounts and we lose the closing animation.

    return (
        <div className={cn(
            "border-t bg-background fixed bottom-0 left-0 right-0 z-[60] shadow-xl transition-all duration-300 ease-in-out",
            // If hub is closed, we still want to render for animation, but pointer events might be an issue.
            // Radix Collapsible handles content visibility.
            // But we might want to hide the header bar if closed? 
            // The footer panel keeps its header always visible as a trigger.
            // Here, the triggers are elsewhere (Sidebar/Header). 
            // So when closed, this whole container should probably be hidden or translated out.
            // If we rely on Collapsible 'open', only the CONTENT is hidden. The header remains.
            // We want the WHOLE panel to disappear when closed? Or mimic FooterLinksPanel?
            // User said "pop up from the footer".
            // Let's hide the container when closed to prevent it blocking the footer.
            !isHubOpen && "invisible pointer-events-none translate-y-full"
        )}>
            <Collapsible open={isHubOpen} onOpenChange={(open) => !open && closeHub()}>
                <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={closeHub}
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                        <span className="font-semibold text-sm flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Blueprint Hub
                        </span>

                        {currentVersion && (
                            <div className="flex items-center gap-2 border-l pl-3 ml-2">
                                <span className="text-xs text-muted-foreground">
                                    v{currentVersion.version_number}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${currentVersion.status === 'draft'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                    : currentVersion.status === 'published'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                    }`}>
                                    {currentVersion.status.charAt(0).toUpperCase() + currentVersion.status.slice(1)}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {currentVersion?.status === 'draft' && (
                            <Button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                            >
                                {isPublishing ? 'Publishing...' : 'Publish Version'}
                            </Button>
                        )}
                    </div>
                </div>

                <CollapsibleContent forceMount className="max-h-[60vh] overflow-hidden flex flex-col data-[state=closed]:hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col overflow-hidden">
                        <div className="border-b px-2 overflow-x-auto shrink-0 bg-background z-10 sticky top-0">
                            <TabsList className="h-10 w-full justify-start bg-transparent p-0 gap-2">
                                <TabsTrigger value="entity-types" className="data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                                    <Box className="w-4 h-4 mr-2" />
                                    Entity Types
                                </TabsTrigger>
                                <TabsTrigger value="theme" className="data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                                    <Palette className="w-4 h-4 mr-2" />
                                    Theme
                                </TabsTrigger>
                                <TabsTrigger value="patterns" className="data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                                    <FileCode className="w-4 h-4 mr-2" />
                                    Patterns
                                </TabsTrigger>
                                <TabsTrigger value="fields" className="data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                                    <Tag className="w-4 h-4 mr-2" />
                                    Fields
                                </TabsTrigger>
                                <TabsTrigger value="relationships" className="data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                                    <Network className="w-4 h-4 mr-2" />
                                    Relationships
                                </TabsTrigger>
                                <TabsTrigger value="attributes" className="data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                                    <Database className="w-4 h-4 mr-2" />
                                    Attributes
                                </TabsTrigger>
                                <TabsTrigger value="views" className="data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                                    <Eye className="w-4 h-4 mr-2" />
                                    Views
                                </TabsTrigger>
                                <TabsTrigger value="mocs" className="data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                                    <Network className="w-4 h-4 mr-2" />
                                    MOCs
                                </TabsTrigger>
                                <TabsTrigger value="networks" className="data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                                    <Users className="w-4 h-4 mr-2" />
                                    Networks
                                </TabsTrigger>
                                <TabsTrigger value="extraction" className="data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                                    <Play className="w-4 h-4 mr-2" />
                                    Extraction
                                </TabsTrigger>
                                <TabsTrigger value="help" className="data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 ml-auto">
                                    <HelpCircle className="w-4 h-4" />
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-auto bg-muted/10 p-4">
                            <TabsContent value="entity-types" className="mt-0 h-full">
                                <EntityTypesTab isLoading={isLoading} />
                            </TabsContent>

                            <TabsContent value="theme" className="mt-0 h-full">
                                <EntityThemeTab />
                            </TabsContent>

                            <TabsContent value="patterns" className="mt-0 h-full">
                                <PatternManager onBack={() => setActiveTab('entity-types')} />
                            </TabsContent>

                            <TabsContent value="fields" className="mt-0 h-full">
                                <FieldsTab isLoading={isLoading} />
                            </TabsContent>

                            <TabsContent value="relationships" className="mt-0 h-full">
                                <RelationshipTypesTab isLoading={isLoading} />
                            </TabsContent>

                            <TabsContent value="attributes" className="mt-0 h-full">
                                <AttributeBlueprintsTab isLoading={isLoading} />
                            </TabsContent>

                            <TabsContent value="views" className="mt-0 h-full">
                                <ViewTemplatesTab isLoading={isLoading} />
                            </TabsContent>

                            <TabsContent value="mocs" className="mt-0 h-full">
                                <MocsTab isLoading={isLoading} />
                            </TabsContent>

                            <TabsContent value="networks" className="mt-0 h-full">
                                <NetworksTab isLoading={isLoading} />
                            </TabsContent>

                            <TabsContent value="extraction" className="mt-0 h-full">
                                <ExtractionTab isLoading={isLoading} />
                            </TabsContent>

                            <TabsContent value="help" className="mt-0 h-full">
                                <div className="max-w-3xl mx-auto space-y-6 p-4">
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Welcome to Blueprint Hub</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Blueprint Hub lets you define the structure of your knowledge base by creating entity types,
                                            fields, relationships, and views.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="font-semibold">Quick Start</h4>

                                        <div className="border rounded-lg p-4 bg-background shadow-sm">
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

                                        <div className="grid grid-cols-2 gap-4 text-sm mt-6">
                                            <div className="p-3 border rounded bg-background/50">
                                                <h5 className="font-medium mb-1">Entity Types</h5>
                                                <p className="text-muted-foreground text-xs">
                                                    Define types of entities (e.g., Character, Location, Item) that your knowledge base will contain.
                                                </p>
                                            </div>

                                            <div className="p-3 border rounded bg-background/50">
                                                <h5 className="font-medium mb-1">Fields</h5>
                                                <p className="text-muted-foreground text-xs">
                                                    Add custom fields to entity types to store specific data (e.g., age, role, coordinates).
                                                </p>
                                            </div>

                                            <div className="p-3 border rounded bg-background/50">
                                                <h5 className="font-medium mb-1">Relationships</h5>
                                                <p className="text-muted-foreground text-xs">
                                                    Define how entity types can be connected (e.g., Character LOCATED_IN Location).
                                                </p>
                                            </div>

                                            <div className="p-3 border rounded bg-background/50">
                                                <h5 className="font-medium mb-1">Patterns</h5>
                                                <p className="text-muted-foreground text-xs">
                                                    Configure regex patterns for detecting and extracting entities from text.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
