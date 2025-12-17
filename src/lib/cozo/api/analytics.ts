import { runAnalyticsPipeline } from '../analytics/analyticsOrchestrator';
import type { AnalyticsPipelineResult } from '../analytics/analyticsOrchestrator';

export async function runNoteAnalytics(noteId: string): Promise<AnalyticsPipelineResult> {
  return runAnalyticsPipeline({
    groupId: `note:${noteId}`,
    runDegree: true,
    runCentrality: true,
    runCommunities: true
  });
}

export async function runFolderAnalytics(folderId: string): Promise<AnalyticsPipelineResult> {
  return runAnalyticsPipeline({
    groupId: `folder:${folderId}`,
    runDegree: true,
    runCentrality: true,
    runCommunities: true
  });
}

export async function runVaultAnalytics(): Promise<AnalyticsPipelineResult> {
  return runAnalyticsPipeline({
    groupId: 'vault:global',
    runDegree: true,
    runCentrality: true,
    runCommunities: true
  });
}
