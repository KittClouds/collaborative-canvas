import React from 'react';
import { useNotes } from '@/contexts/NotesContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BacklinkInfo } from '@/lib/linking/LinkIndex';
import { getDisplayName, parseEntityFromTitle } from '@/lib/entities/titleParser';
import { ENTITY_COLORS, EntityKind } from '@/lib/entities/entityTypes';

interface BacklinksPanelProps {
  backlinks: BacklinkInfo[];
  onNavigate: (title: string) => void;
}

export function BacklinksPanel({ backlinks, onNavigate }: BacklinksPanelProps) {
  return (
    <Card className="h-full flex flex-col border-0 bg-transparent shadow-none">
      <CardHeader className="pb-3 px-3 pt-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Backlinks
          <Badge variant="secondary" className="ml-auto">
            {backlinks.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full px-3">
          {backlinks.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No backlinks yet</p>
              <p className="text-xs mt-1 opacity-70">
                Other notes will appear here when they link to this note
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {backlinks.map((backlink, idx) => {
                const parsed = parseEntityFromTitle(backlink.sourceNoteTitle);
                const displayName = getDisplayName(backlink.sourceNoteTitle);
                const entityColor = parsed?.kind ? ENTITY_COLORS[parsed.kind as EntityKind] : undefined;
                
                return (
                  <div
                    key={`${backlink.sourceNoteId}-${idx}`}
                    className="p-3 rounded-md border bg-card hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => onNavigate(backlink.sourceNoteTitle)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div 
                          className="font-medium text-sm truncate"
                          style={entityColor ? { color: entityColor } : undefined}
                        >
                          {displayName}
                        </div>
                        {parsed?.kind && (
                          <Badge 
                            variant="outline" 
                            className="text-xs mt-1"
                            style={entityColor ? { 
                              backgroundColor: `${entityColor}20`, 
                              color: entityColor,
                              borderColor: `${entityColor}40`
                            } : undefined}
                          >
                            {parsed.kind}
                          </Badge>
                        )}
                        {backlink.context && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {backlink.context}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {backlink.linkType}
                      </Badge>
                    </div>
                    {backlink.linkCount > 1 && (
                      <div className="text-xs text-muted-foreground mt-2">
                        {backlink.linkCount} mentions
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default BacklinksPanel;
