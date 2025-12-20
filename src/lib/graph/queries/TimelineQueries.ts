import { getGraph } from '@/lib/graph/graphInstance';
import type { UnifiedGraph } from '@/lib/graph/UnifiedGraph';
import type { UnifiedNode, NodeId } from '@/lib/graph/types';
import type { TemporalPoint } from '@/types/temporal';

export interface TimelineEvent {
  id: string;
  label: string;
  type: 'SCENE' | 'EVENT' | 'BEAT' | 'CHAPTER' | 'ACT';
  temporal: {
    start: TemporalPoint;
    end?: TemporalPoint;
    confidence: number;
  };
  participants: string[];
  location?: string;
  description?: string;
  sequence?: number;
  parentId?: string;
}

export interface TimelineRange {
  startYear?: number;
  endYear?: number;
  startMonth?: number;
  endMonth?: number;
}

export class TimelineQueries {
  private graph: UnifiedGraph;

  constructor() {
    this.graph = getGraph();
  }

  getAllTemporalNodes(): UnifiedNode[] {
    return this.graph.filterNodes(node => !!node.data.temporal);
  }

  getNodesInRange(range: TimelineRange): UnifiedNode[] {
    const allNodes = this.getAllTemporalNodes();

    return allNodes.filter(node => {
      const temporal = node.data.temporal;
      if (!temporal) return false;

      const start = temporal.start;
      
      if (range.startYear && start.year && start.year < range.startYear) return false;
      if (range.endYear && start.year && start.year > range.endYear) return false;

      if (range.startMonth && start.month) {
        if (start.year === range.startYear && start.month < range.startMonth) return false;
      }
      if (range.endMonth && start.month) {
        if (start.year === range.endYear && start.month > range.endMonth) return false;
      }

      return true;
    });
  }

  getTimelineEvents(): TimelineEvent[] {
    const nodes = this.getAllTemporalNodes();

    const events: TimelineEvent[] = nodes.map(node => ({
      id: node.data.id,
      label: node.data.label,
      type: node.data.entityKind as TimelineEvent['type'],
      temporal: node.data.temporal!,
      participants: node.data.sceneMetadata?.participants || 
                   node.data.eventMetadata?.participants || [],
      location: node.data.sceneMetadata?.location,
      description: node.data.eventMetadata?.description,
      sequence: node.data.narrativeMetadata?.sequence,
      parentId: node.data.parentId,
    }));

    return events.sort((a, b) => {
      const aTime = this.temporalToTimestamp(a.temporal.start);
      const bTime = this.temporalToTimestamp(b.temporal.start);
      
      if (aTime !== bTime) return aTime - bTime;
      return (a.sequence || 0) - (b.sequence || 0);
    });
  }

  getNarrativeHierarchy(rootId?: NodeId): UnifiedNode[] {
    return this.graph.getNarrativeHierarchy(rootId);
  }

  getScenesInChapter(chapterId: NodeId): UnifiedNode[] {
    return this.graph.getNarrativeChildren(chapterId)
      .filter(n => n.data.entityKind === 'SCENE');
  }

  getEventsForCharacter(characterId: NodeId): TimelineEvent[] {
    const nodes = this.getAllTemporalNodes();
    
    return nodes
      .filter(node => {
        const participants = node.data.sceneMetadata?.participants || 
                           node.data.eventMetadata?.participants || [];
        return participants.includes(characterId);
      })
      .map(node => ({
        id: node.data.id,
        label: node.data.label,
        type: node.data.entityKind as TimelineEvent['type'],
        temporal: node.data.temporal!,
        participants: node.data.sceneMetadata?.participants || 
                     node.data.eventMetadata?.participants || [],
        location: node.data.sceneMetadata?.location,
        description: node.data.eventMetadata?.description,
        sequence: node.data.narrativeMetadata?.sequence,
        parentId: node.data.parentId,
      }));
  }

  getTimelineGaps(thresholdDays: number = 30): Array<{ 
    start: TemporalPoint; 
    end: TemporalPoint; 
    days: number 
  }> {
    const events = this.getTimelineEvents();
    const gaps: Array<{ start: TemporalPoint; end: TemporalPoint; days: number }> = [];

    for (let i = 0; i < events.length - 1; i++) {
      const current = events[i];
      const next = events[i + 1];

      const endTime = this.temporalToTimestamp(current.temporal.end || current.temporal.start);
      const nextStartTime = this.temporalToTimestamp(next.temporal.start);

      const gapDays = (nextStartTime - endTime) / (1000 * 60 * 60 * 24);

      if (gapDays > thresholdDays) {
        gaps.push({
          start: current.temporal.end || current.temporal.start,
          end: next.temporal.start,
          days: gapDays,
        });
      }
    }

    return gaps;
  }

  private temporalToTimestamp(temporal: TemporalPoint): number {
    const year = temporal.year || 0;
    const month = temporal.month || 1;
    const day = temporal.day || 1;
    const hour = temporal.hour || 0;
    const minute = temporal.minute || 0;

    return new Date(year, month - 1, day, hour, minute).getTime();
  }
}

let timelineQueries: TimelineQueries | null = null;

export function getTimelineQueries(): TimelineQueries {
  if (!timelineQueries) {
    timelineQueries = new TimelineQueries();
  }
  return timelineQueries;
}
