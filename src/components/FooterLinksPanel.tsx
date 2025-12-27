import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowLeft, ArrowRight, Users, Boxes, Clock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import BacklinksPanel from './BacklinksPanel';
import OutgoingLinksPanel from './OutgoingLinksPanel';
import { EntityMentionsPanel } from './EntityMentionsPanel';
import type { BacklinkInfo, WikiLink } from '@/lib/linking/LinkIndex';
import type { Note } from '@/types/noteTypes';
import type { EntityKind } from '@/lib/entities/entityTypes';
import { cn } from '@/lib/utils';

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
  // New props for integrated footer
  isHubOpen: boolean;
  toggleHub: () => void;
  isSaving: boolean;
  lastSaved: Date | null | boolean;
  notesCount: number;
}

export const FooterLinksPanel = ({
  backlinks,
  outgoingLinks,
  entityStats,
  notes,
  getEntityMentions,
  onNavigate,
  isHubOpen,
  toggleHub,
  isSaving,
  lastSaved,
  notesCount
}: FooterLinksPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const backlinksCount = backlinks.length;
  const outgoingLinksCount = outgoingLinks.length;
  const entityCount = entityStats.length;

  return (
    <div className="border-t bg-background w-full mt-auto z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.1)]">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center h-9 px-2 gap-2 bg-card/50 backdrop-blur-sm">
          {/* Blueprint Hub Trigger */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleHub}
            className={cn(
              "h-7 px-2 gap-2 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors",
              isHubOpen && "bg-accent text-accent-foreground"
            )}
          >
            <Boxes className="h-3.5 w-3.5" />
            Blueprint Hub
          </Button>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Links Panel Trigger */}
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="h-7 px-2 flex-1 justify-start gap-3 hover:bg-accent/50 text-xs text-muted-foreground hover:text-foreground"
            >
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <span className="font-medium text-foreground">Links</span>
              <span className="flex items-center gap-2 opacity-80">
                <span>{backlinksCount} back</span>
                <span className="w-0.5 h-0.5 rounded-full bg-border" />
                <span>{outgoingLinksCount} out</span>
                <span className="w-0.5 h-0.5 rounded-full bg-border" />
                <span>{entityCount} entities</span>
              </span>
            </Button>
          </CollapsibleTrigger>

          {/* Status Indicators (Restored Old UI) */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground px-2 min-w-fit">
            <span>{notesCount} notes</span>
            {isSaving ? (
              <span className="flex items-center gap-1.5 animate-pulse text-primary">
                <Clock className="h-3.5 w-3.5" />
                Saving...
              </span>
            ) : lastSaved ? (
              <span className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
                <Check className="h-3.5 w-3.5" />
                Saved
              </span>
            ) : null}
          </div>
        </div>

        <CollapsibleContent className="border-t max-h-[50vh] overflow-auto custom-scrollbar bg-background">
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
