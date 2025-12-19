import type { ExtractionResult, ReconciliationDecision, ReconciliationReport, ReconciliationOptions } from './types';
import { conflictResolver } from './ConflictResolver';
import { userCorrectionStore } from './UserCorrectionStore';
import { syncEvents } from '../events/SyncEventEmitter';
import type { SyncEntity } from '../types';

export interface ReconciliationInput {
  noteId: string;
  noteTitle: string;
  results: ExtractionResult[];
}

export interface EntityCommit {
  name: string;
  entityKind: string;
  entitySubtype?: string;
  extractionMethod: string;
  noteIds: string[];
  confidence: number;
  isNew: boolean;
  existingEntityId?: string;
}

type EntityUpsertFn = (payload: {
  id?: string;
  name: string;
  entityKind: string;
  entitySubtype?: string | null;
  groupId: string;
  scopeType: string;
  frequency?: number;
  extractionMethod?: string;
}) => SyncEntity;

type EntityFinderFn = (name: string, entityKind: string) => SyncEntity | undefined;

export class EntityReconciliationCoordinator {
  private upsertEntity: EntityUpsertFn | null = null;
  private findExistingEntity: EntityFinderFn | null = null;

  registerEntityHandlers(upsert: EntityUpsertFn, finder: EntityFinderFn): void {
    this.upsertEntity = upsert;
    this.findExistingEntity = finder;
  }

  async reconcile(
    input: ReconciliationInput,
    options: ReconciliationOptions = {}
  ): Promise<ReconciliationReport> {
    const { results, noteId } = input;
    const { dryRun = false, mergeWithExisting = true } = options;

    const report: ReconciliationReport = {
      created: [],
      merged: [],
      conflicts: [],
      skipped: [],
    };

    if (results.length === 0) {
      return report;
    }

    syncEvents.emit('extractionStarted', { noteId, count: results.length }, 'reconciliation');

    const decisions = await conflictResolver.resolveAll(results);

    for (const decision of decisions) {
      await this.processDecision(decision, noteId, report, dryRun, mergeWithExisting);
    }

    syncEvents.emit('extractionCompleted', { noteId, report }, 'reconciliation');
    syncEvents.emit('reconciliationCompleted', report, 'reconciliation');

    return report;
  }

  private async processDecision(
    decision: ReconciliationDecision,
    noteId: string,
    report: ReconciliationReport,
    dryRun: boolean,
    mergeWithExisting: boolean
  ): Promise<void> {
    const { extractionResults, canonicalType } = decision;
    const primaryResult = extractionResults[0];
    const entityName = primaryResult.text;

    if (conflictResolver.detectConflicts(extractionResults)) {
      report.conflicts.push({
        text: entityName,
        conflictingTypes: extractionResults.map(r => ({
          type: r.entityType,
          source: r.source,
          confidence: r.confidence,
        })),
      });
    }

    if (dryRun) {
      return;
    }

    if (!this.upsertEntity) {
      console.warn('[EntityReconciliationCoordinator] No upsert handler registered, skipping commit');
      report.skipped.push(entityName);
      return;
    }

    let existingEntity: SyncEntity | undefined;
    if (mergeWithExisting && this.findExistingEntity) {
      existingEntity = this.findExistingEntity(entityName, canonicalType);
    }

    if (existingEntity) {
      this.upsertEntity({
        id: existingEntity.id,
        name: existingEntity.name,
        entityKind: canonicalType,
        entitySubtype: decision.canonicalSubtype || existingEntity.entitySubtype,
        groupId: existingEntity.groupId,
        scopeType: existingEntity.scopeType,
        frequency: existingEntity.frequency + 1,
        extractionMethod: primaryResult.source,
      });

      report.merged.push(entityName);

      syncEvents.emit('entityMerged', {
        entityId: existingEntity.id,
        entityName,
        entityType: canonicalType,
        noteId,
      }, 'reconciliation');
    } else {
      const newEntity = this.upsertEntity({
        name: entityName,
        entityKind: canonicalType,
        entitySubtype: decision.canonicalSubtype,
        groupId: 'default',
        scopeType: 'document',
        frequency: 1,
        extractionMethod: primaryResult.source,
      });

      report.created.push(entityName);

      syncEvents.emit('entityExtracted', {
        entityId: newEntity.id,
        entityName,
        entityType: canonicalType,
        source: primaryResult.source,
        noteId,
      }, 'reconciliation');
    }
  }

  async setUserOverride(
    text: string,
    entityType: string,
    entitySubtype?: string,
    noteContext?: string
  ): Promise<void> {
    await userCorrectionStore.initialize();
    const override = userCorrectionStore.setOverride(text, entityType, entitySubtype, noteContext);

    syncEvents.emit('entityTypeChanged', {
      entityName: text,
      newType: entityType,
      previousType: undefined,
      source: 'user_override',
    }, 'reconciliation');

    return Promise.resolve();
  }

  async removeUserOverride(text: string, noteContext?: string): Promise<void> {
    await userCorrectionStore.initialize();
    userCorrectionStore.removeOverride(text, noteContext);
  }

  getCommitPreview(decisions: ReconciliationDecision[]): EntityCommit[] {
    return decisions.map(decision => {
      const primaryResult = decision.extractionResults[0];
      const avgConfidence = decision.extractionResults.reduce((sum, r) => sum + r.confidence, 0) / decision.extractionResults.length;

      let existingEntity: SyncEntity | undefined;
      if (this.findExistingEntity) {
        existingEntity = this.findExistingEntity(primaryResult.text, decision.canonicalType);
      }

      return {
        name: primaryResult.text,
        entityKind: decision.canonicalType,
        entitySubtype: decision.canonicalSubtype,
        extractionMethod: primaryResult.source,
        noteIds: [primaryResult.context.noteId],
        confidence: avgConfidence,
        isNew: !existingEntity,
        existingEntityId: existingEntity?.id,
      };
    });
  }
}

export const entityReconciliationCoordinator = new EntityReconciliationCoordinator();
