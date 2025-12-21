// src/components/FooterLinksPanel.tsx
import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowLeft, ArrowRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import BacklinksPanel from './BacklinksPanel';
import OutgoingLinksPanel from './OutgoingLinksPanel';
import { EntityMentionsPanel } from './EntityMentionsPanel';
import type { BacklinkInfo, WikiLink } from '@/lib/linking/LinkIndex';
import type { Note } from '@/contexts/NotesContext';
import type { EntityKind } from '@/lib/entities/entityTypes';

interface EntityStats {
  entityKind: EntityKind;
  entityLabel: string;
  mentionsInThisNote: number;
  mentionsAcrossVault: number;
  appearanceCount: number;
}

interface FooterLinksPanelProps {
  backlinks: BacklinkInfo[];
  outgoingLinks: WikiLink[];
  entityStats: EntityStats[];
  notes: Note[];
  getEntityMentions: (label: string, kind?: EntityKind) => BacklinkInfo[];
  onNavigate: (title: string, createIfNotExists?: boolean, link?: WikiLink) => void;
}

export const FooterLinksPanel = ({
  backlinks,
  outgoingLinks,
  entityStats,
  notes,
  getEntityMentions,
  onNavigate
}: FooterLinksPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const backlinksCount = backlinks.length;
  const outgoingLinksCount = outgoingLinks.length;
  const entityCount = entityStats.length;

  return (
    <div className="border-t bg-background fixed bottom-0 left-0 right-0 z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-3 h-auto hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="font-medium">Links</span>
              <span className="text-sm text-muted-foreground">
                {backlinksCount} back, {outgoingLinksCount} out, {entityCount} entities
              </span>
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4 rotate-[-90deg]" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="border-t max-h-[50vh] overflow-auto">
          <div className="p-4">
            <Tabs defaultValue="out" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="back" className="flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" />
                  Back ({backlinksCount})
                </TabsTrigger>
                <TabsTrigger value="out" className="flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  Out ({outgoingLinksCount})
                </TabsTrigger>
                <TabsTrigger value="entities" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Entities ({entityCount})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="back" className="mt-4">
                <BacklinksPanel backlinks={backlinks} onNavigate={onNavigate} />
              </TabsContent>

              <TabsContent value="out" className="mt-4">
                <OutgoingLinksPanel outgoingLinks={outgoingLinks} notes={notes} onNavigate={onNavigate} />
              </TabsContent>

              <TabsContent value="entities" className="mt-4">
                <EntityMentionsPanel
                  entityStats={entityStats}
                  getEntityMentions={getEntityMentions}
                  onNavigate={(title) => onNavigate(title)}
                />
              </TabsContent>
            </Tabs>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
