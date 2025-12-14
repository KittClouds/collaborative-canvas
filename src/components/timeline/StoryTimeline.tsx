/**
 * StoryTimeline - Rich nested timeline visualization for narrative storytelling
 * Uses react-chrono for timeline rendering with custom styling
 */

import React, { useMemo, useState } from 'react';
import { Chrono } from 'react-chrono';
import { StoryTimelineBuilder, TimelineBuilderOptions } from '@/lib/timeline/timelineBuilder';
import { SceneEntity, EventEntity, TimelineConfig } from '@/types/storyEntities';
import { ENTITY_COLORS } from '@/lib/entities/entityTypes';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Columns, 
  LayoutList, 
  AlignLeft, 
  Filter,
  User,
  MapPin
} from 'lucide-react';

interface StoryTimelineProps {
  scenes: SceneEntity[];
  events: EventEntity[];
  entities: any[];
  config?: Partial<TimelineConfig>;
  options?: TimelineBuilderOptions;
  onItemClick?: (entityId: string, entityKind: string) => void;
  characterFilter?: string;
  locationFilter?: string;
  className?: string;
}

type TimelineMode = 'VERTICAL' | 'VERTICAL_ALTERNATING' | 'HORIZONTAL';

export function StoryTimeline({
  scenes,
  events,
  entities,
  config,
  options,
  onItemClick,
  characterFilter,
  locationFilter,
  className = ''
}: StoryTimelineProps) {
  const [mode, setMode] = useState<TimelineMode>(config?.mode || 'VERTICAL');
  const [importanceFilter, setImportanceFilter] = useState<string[]>([]);

  // Build timeline items
  const timelineItems = useMemo(() => {
    const builder = new StoryTimelineBuilder(scenes, events, entities, {
      ...options,
      filterByImportance: importanceFilter.length > 0 
        ? importanceFilter as any[] 
        : undefined
    });

    // Apply character or location filter
    if (characterFilter) {
      return builder.buildForCharacter(characterFilter);
    }
    if (locationFilter) {
      return builder.buildForLocation(locationFilter);
    }

    return builder.build();
  }, [scenes, events, entities, options, importanceFilter, characterFilter, locationFilter]);

  // Custom theme based on design system
  const theme = useMemo(() => ({
    primary: 'hsl(var(--primary))',
    secondary: 'hsl(var(--secondary))',
    cardBgColor: 'hsl(var(--card))',
    cardForeColor: 'hsl(var(--card-foreground))',
    titleColor: 'hsl(var(--foreground))',
    titleColorActive: 'hsl(var(--primary))',
    cardTitleColor: 'hsl(var(--foreground))',
    cardSubtitleColor: 'hsl(var(--muted-foreground))',
    cardDetailsColor: 'hsl(var(--muted-foreground))',
    toolbarBgColor: 'hsl(var(--background))',
    toolbarBtnBgColor: 'hsl(var(--muted))',
    toolbarTextColor: 'hsl(var(--foreground))',
    nestedCardBgColor: 'hsl(var(--muted))',
    nestedCardDetailsColor: 'hsl(var(--muted-foreground))',
  }), []);

  // Handle item selection
  const handleItemSelected = (data: { cardTitle?: string, cardSubtitle?: string }) => {
    // Find matching item by title
    const item = timelineItems.find(i => 
      i.cardTitle === data.cardTitle && i.cardSubtitle === data.cardSubtitle
    );
    if (item?.entityId && item?.entityKind && onItemClick) {
      onItemClick(item.entityId, item.entityKind);
    }
  };

  const toggleImportance = (level: string) => {
    setImportanceFilter(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  if (timelineItems.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
        <div className="text-muted-foreground mb-2">No timeline events found</div>
        <p className="text-sm text-muted-foreground/70">
          Create scenes and events with temporal data to see them here
        </p>
      </div>
    );
  }

  return (
    <div className={`story-timeline-container flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-border/50 bg-background/50">
        {/* Layout mode selector */}
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          <Button
            variant={mode === 'VERTICAL' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('VERTICAL')}
            className="h-7 px-2"
          >
            <LayoutList className="w-4 h-4" />
          </Button>
          <Button
            variant={mode === 'VERTICAL_ALTERNATING' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('VERTICAL_ALTERNATING')}
            className="h-7 px-2"
          >
            <Columns className="w-4 h-4" />
          </Button>
          <Button
            variant={mode === 'HORIZONTAL' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('HORIZONTAL')}
            className="h-7 px-2"
          >
            <AlignLeft className="w-4 h-4 rotate-90" />
          </Button>
        </div>

        {/* Importance filter */}
        <div className="flex items-center gap-1 ml-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {(['critical', 'major', 'minor'] as const).map(level => (
            <Badge
              key={level}
              variant={importanceFilter.includes(level) ? 'default' : 'outline'}
              className="cursor-pointer text-xs capitalize"
              onClick={() => toggleImportance(level)}
            >
              {level}
            </Badge>
          ))}
        </div>

        {/* Active filters display */}
        {characterFilter && (
          <Badge variant="secondary" className="ml-auto gap-1">
            <User className="w-3 h-3" />
            {entities.find(e => e.id === characterFilter)?.label || 'Character'}
          </Badge>
        )}
        {locationFilter && (
          <Badge variant="secondary" className="ml-auto gap-1">
            <MapPin className="w-3 h-3" />
            {locationFilter}
          </Badge>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {timelineItems.length} event{timelineItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto p-4">
        <Chrono
          items={timelineItems}
          mode={mode}
          cardHeight={config?.cardHeight || 200}
          nestedCardHeight={config?.nestedCardHeight || 150}
          showAllCardsHorizontal={config?.showAllCardsHorizontal}
          enableOutline={config?.enableOutline}
          slideShow={config?.slideShow ?? false}
          theme={theme}
          fontSizes={{
            cardSubtitle: '0.8rem',
            cardText: '0.85rem',
            cardTitle: '1rem',
            title: '0.9rem',
          }}
          buttonTexts={{
            first: 'First',
            last: 'Last',
            next: 'Next',
            previous: 'Previous',
          }}
          enableBreakPoint
          scrollable={{ scrollbar: false }}
          useReadMore={false}
          onItemSelected={handleItemSelected}
          classNames={{
            card: 'timeline-card',
            cardMedia: 'timeline-media',
            cardSubTitle: 'timeline-subtitle',
            cardText: 'timeline-text',
            cardTitle: 'timeline-title',
            title: 'timeline-point-title',
          }}
        />
      </div>

      <style>{`
        .story-timeline-container .timeline-card {
          border-radius: 8px;
          box-shadow: 0 2px 8px hsl(var(--foreground) / 0.05);
        }
        .story-timeline-container .timeline-title {
          font-weight: 600;
        }
        .story-timeline-container .timeline-subtitle {
          opacity: 0.8;
        }
        .story-timeline-container .timeline-text {
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
}

export default StoryTimeline;
