import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, FileQuestion } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WikiLink } from '@/lib/linking/LinkIndex';
import type { Note } from '@/types/noteTypes';
import { ENTITY_COLORS } from '@/lib/entities/entityTypes';

interface OutgoingLinksPanelProps {
  outgoingLinks: WikiLink[];
  notes: Note[];
  onNavigate: (title: string, createIfNotExists?: boolean, link?: WikiLink) => void;
}

export function OutgoingLinksPanel({ outgoingLinks, notes, onNavigate }: OutgoingLinksPanelProps) {
  // Check if a link target exists
  const checkLinkExists = (link: WikiLink): boolean => {
    const normalizedTarget = link.targetTitle.toLowerCase().trim();
    return notes.some(n =>
      n.title.toLowerCase().trim() === normalizedTarget ||
      (n.isEntity && n.entityLabel?.toLowerCase().trim() === normalizedTarget)
    );
  };

  // Group by link type
  const wikilinks = outgoingLinks.filter(l => l.linkType === 'wikilink');
  const entityLinks = outgoingLinks.filter(l => l.linkType === 'entity');
  const mentions = outgoingLinks.filter(l => l.linkType === 'mention');

  // Deduplicate links by target title
  const dedupeLinks = (links: WikiLink[]): WikiLink[] => {
    const seen = new Set<string>();
    return links.filter(link => {
      const key = `${link.linkType}:${link.entityKind || ''}:${link.targetTitle.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const uniqueWikilinks = dedupeLinks(wikilinks);
  const uniqueEntityLinks = dedupeLinks(entityLinks);
  const uniqueMentions = dedupeLinks(mentions);
  const totalLinks = uniqueWikilinks.length + uniqueEntityLinks.length + uniqueMentions.length;

  return (
    <Card className="h-full flex flex-col border-0 bg-transparent shadow-none">
      <CardHeader className="pb-3 px-3 pt-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          Outgoing Links
          <Badge variant="secondary" className="ml-auto">
            {totalLinks}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full px-3">
          {totalLinks === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <ArrowRight className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No outgoing links</p>
              <p className="text-xs mt-1 opacity-70">
                Use [[Note Title]] or [TYPE|Label] to create connections
              </p>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {uniqueWikilinks.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Wikilinks
                  </h4>
                  <div className="space-y-1">
                    {uniqueWikilinks.map((link, idx) => {
                      const exists = checkLinkExists(link);
                      return (
                        <div
                          key={`wikilink-${idx}`}
                          className="p-2 rounded-md bg-card hover:bg-accent transition-colors cursor-pointer flex items-center gap-2 border"
                          onClick={() => onNavigate(link.targetTitle, true, link)}
                        >
                          {!exists && <FileQuestion className="h-3 w-3 text-destructive shrink-0" />}
                          <span className={`text-sm flex-1 truncate ${!exists ? 'text-destructive' : ''}`}>
                            {link.targetTitle}
                          </span>
                          {!exists && (
                            <Badge variant="destructive" className="text-xs shrink-0">
                              Create
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {uniqueEntityLinks.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Entity References
                  </h4>
                  <div className="space-y-1">
                    {uniqueEntityLinks.map((link, idx) => {
                      const exists = checkLinkExists(link);
                      const color = link.entityKind ? ENTITY_COLORS[link.entityKind] : undefined;
                      return (
                        <div
                          key={`entity-${idx}`}
                          className="p-2 rounded-md bg-card hover:bg-accent transition-colors cursor-pointer flex items-center gap-2 border"
                          onClick={() => onNavigate(link.targetTitle, true, link)}
                        >
                          <Badge
                            variant="outline"
                            className="text-xs shrink-0"
                            style={color ? {
                              backgroundColor: `${color}20`,
                              color,
                              borderColor: `${color}40`
                            } : undefined}
                          >
                            {link.entityKind}
                          </Badge>
                          {!exists && <FileQuestion className="h-3 w-3 text-destructive shrink-0" />}
                          <span className={`text-sm flex-1 truncate ${!exists ? 'text-destructive' : ''}`}>
                            {link.targetTitle}
                          </span>
                          {!exists && (
                            <Badge variant="destructive" className="text-xs shrink-0">
                              Create
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {uniqueMentions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Mentions
                  </h4>
                  <div className="space-y-1">
                    {uniqueMentions.map((link, idx) => {
                      const exists = checkLinkExists(link);
                      return (
                        <div
                          key={`mention-${idx}`}
                          className="p-2 rounded-md bg-card hover:bg-accent transition-colors cursor-pointer flex items-center gap-2 border"
                          onClick={() => onNavigate(link.targetTitle, true, link)}
                        >
                          <span className="text-muted-foreground">@</span>
                          {!exists && <FileQuestion className="h-3 w-3 text-destructive shrink-0" />}
                          <span className={`text-sm flex-1 truncate ${!exists ? 'text-destructive' : ''}`}>
                            {link.targetTitle}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default OutgoingLinksPanel;
