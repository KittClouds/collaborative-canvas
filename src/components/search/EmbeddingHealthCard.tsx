import { CheckCircle2, Database, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { EmbeddingHealth } from '@/lib/embeddings/healthTracker';

interface EmbeddingHealthCardProps {
  health: EmbeddingHealth;
  isLoading?: boolean;
}

export function EmbeddingHealthCard({ health, isLoading }: EmbeddingHealthCardProps) {
  const syncPercentage = health.totalNotes > 0
    ? Math.round((health.syncedNotes / health.totalNotes) * 100)
    : 0;

  return (
    <Card className="bg-sidebar-accent border-sidebar-border">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Embedding Health</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Database className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Embeddings:</span>
            <span className="font-medium">{health.embeddingsCount}</span>
          </div>

          <div className="flex items-center gap-2">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Notes:</span>
            <span className="font-medium">{health.totalNotes}</span>
          </div>
        </div>

        {health.totalNotes > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Synced</span>
              <span className="font-medium">{syncPercentage}%</span>
            </div>
            <div className="h-1.5 bg-sidebar-border rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${syncPercentage}%` }}
              />
            </div>
          </div>
        )}

        {health.lastSyncAt && (
          <div className="mt-2 text-xs text-muted-foreground">
            Last sync: {formatRelativeTime(health.lastSyncAt)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
