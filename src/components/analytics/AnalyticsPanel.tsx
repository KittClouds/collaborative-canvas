import React, { useMemo, useState } from 'react';
import {
  FileText,
  Clock,
  MessageSquare,
  BookOpen,
  TrendingUp,
  Hash
} from 'lucide-react';
import { useNotes } from '@/contexts/NotesContext';
import { analyzeText, parseContentToPlainText, TextAnalytics } from '@/lib/analytics/textAnalytics';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FlowScoreSection } from './FlowScoreSection';

export function AnalyticsPanel() {
  const { state } = useNotes();
  const selectedNote = state.notes.find(n => n.id === state.selectedNoteId);
  const [minCount, setMinCount] = useState(1);

  // Parse and analyze content
  const analytics = useMemo<TextAnalytics | null>(() => {
    if (!selectedNote?.content) {
      return null;
    }

    const plainText = parseContentToPlainText(selectedNote.content);
    if (!plainText.trim()) {
      return null;
    }

    return analyzeText(plainText);
  }, [selectedNote?.content]);

  if (!selectedNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">
          Select a note to view analytics
        </p>
      </div>
    );
  }

  if (!analytics || analytics.wordCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm text-muted-foreground">
          Start writing to see analytics
        </p>
      </div>
    );
  }

  const filteredKeywords = analytics.keywordDensity.filter(k => k.count >= minCount);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Document Statistics */}
        <Section title="Document Stats" icon={FileText}>
          <StatRow label="Words" value={analytics.wordCount.toLocaleString()} />
          <StatRow label="Characters" value={analytics.characterCount.toLocaleString()} />
          <StatRow label="Characters (no spaces)" value={analytics.characterCountNoSpaces.toLocaleString()} />
          <StatRow label="Sentences" value={analytics.sentenceCount.toLocaleString()} />
          <StatRow label="Paragraphs" value={analytics.paragraphCount.toLocaleString()} />
        </Section>

        {/* Reading Metrics */}
        <Section title="Reading Metrics" icon={BookOpen}>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-muted-foreground">Reading Level</span>
            <Badge variant="secondary" className="font-medium">
              {analytics.readingLevel}
            </Badge>
          </div>
          <StatRow
            label="Reading Time"
            value={formatTime(analytics.readingTimeMinutes, analytics.readingTimeSeconds)}
            icon={Clock}
          />
          <StatRow
            label="Speaking Time"
            value={formatTime(analytics.speakingTimeMinutes, analytics.speakingTimeSeconds)}
            icon={MessageSquare}
          />
          <StatRow
            label="Avg. Sentence Length"
            value={`${analytics.averageSentenceLength} words`}
          />
        </Section>

        {/* Enhanced Flow Score */}
        <Section title="" icon={() => null}>
          <FlowScoreSection
            score={analytics.flowScore}
            distribution={analytics.sentenceLengthDistribution}
            insights={analytics.flowInsights}
          />
        </Section>

        {/* Keyword Density */}
        <Section title="Keyword Density" icon={Hash}>
          <div className="space-y-3">
            {/* Filter buttons */}
            <div className="flex gap-1">
              {[1, 2, 3].map((count) => (
                <Button
                  key={count}
                  variant={minCount === count ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setMinCount(count)}
                >
                  ×{count}+
                </Button>
              ))}
            </div>

            {/* Keyword list */}
            <div className="space-y-1">
              {filteredKeywords.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  No keywords match the filter.
                </p>
              ) : (
                filteredKeywords.map((item, index) => (
                  <div
                    key={item.word}
                    className="flex items-center justify-between py-1 text-sm"
                  >
                    <span className={cn(
                      "truncate flex-1",
                      index < 3 && "font-medium"
                    )}>
                      {item.word}
                    </span>
                    <Badge variant="outline" className="ml-2 text-xs font-normal">
                      {item.count} ({item.percentage}%)
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}

// Helper Components
interface SectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

function Section({ title, icon: Icon, children }: SectionProps) {
  if (!title) {
    // For Flow Score section, just return children without section wrapper
    return <>{children}</>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-primary" />
        <span>{title}</span>
      </div>
      <div className="pl-6 space-y-1">
        {children}
      </div>
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
}

function StatRow({ label, value, icon: Icon }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <Badge variant="secondary" className="font-mono text-xs">
        {value}
      </Badge>
    </div>
  );
}

function formatTime(minutes: number, seconds: number): string {
  if (minutes === 0 && seconds === 0) return '< 1 sec';
  if (minutes === 0) return `${seconds} sec`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes} min ${seconds} sec`;
}
