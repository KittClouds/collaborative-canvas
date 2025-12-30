/**
 * StoryTimeline - Rich nested timeline visualization for narrative storytelling
 * PREVIOUSLY used react-chrono, now placeholder awaiting refactor
 */

import React from 'react';
import { SceneEntity, EventEntity, TimelineConfig } from '@/types/storyEntities';
import { TimelineBuilderOptions } from '@/lib/timeline/timelineBuilder';
import { Construction } from 'lucide-react';

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

export function StoryTimeline({
  className = ''
}: StoryTimelineProps) {

  return (
    <div className={`story-timeline-container flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground ${className}`}>
      <Construction className="w-12 h-12 mb-4 opacity-50" />
      <h3 className="text-lg font-semibold mb-2">Timeline View Refactoring</h3>
      <p className="max-w-md text-sm">
        The Story Timeline is currently being rebuilt to improve performance and customization.
        Please check back later for the updated timeline visualization.
      </p>
    </div>
  );
}

export default StoryTimeline;
