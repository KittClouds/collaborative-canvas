import type { ExtractionResult, ExtractionSource, ReconciliationDecision, EntityTypeOverride } from './types';
import { userCorrectionStore } from './UserCorrectionStore';

const SOURCE_PRIORITY: Record<ExtractionSource, number> = {
  manual: 100,
  title: 90,
  regex: 80,
  blueprint: 70,
  llm: 50,
  ner: 40,
  wikilink: 30,
};

export class ConflictResolver {
  groupByNormalizedText(results: ExtractionResult[]): Map<string, ExtractionResult[]> {
    const groups = new Map<string, ExtractionResult[]>();

    for (const result of results) {
      const key = result.normalizedText;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(result);
    }

    return groups;
  }

  detectConflicts(results: ExtractionResult[]): boolean {
    if (results.length <= 1) return false;

    const types = new Set(results.map(r => r.entityType));
    return types.size > 1;
  }

  async resolve(results: ExtractionResult[]): Promise<ReconciliationDecision> {
    if (results.length === 0) {
      throw new Error('Cannot resolve empty results array');
    }

    const normalizedText = results[0].normalizedText;
    const noteId = results[0].context.noteId;

    const userOverride = userCorrectionStore.getOverride(normalizedText, noteId);
    if (userOverride) {
      return this.createDecision(results, userOverride.entityType, userOverride.entitySubtype, 'user_override');
    }

    const blueprintResult = results.find(r => r.source === 'blueprint');
    if (blueprintResult) {
      return this.createDecision(results, blueprintResult.entityType, blueprintResult.entitySubtype, 'blueprint_match');
    }

    if (!this.detectConflicts(results)) {
      return this.createDecision(results, results[0].entityType, results[0].entitySubtype, 'highest_confidence');
    }

    return this.resolveByPriority(results);
  }

  private resolveByPriority(results: ExtractionResult[]): ReconciliationDecision {
    const sorted = [...results].sort((a, b) => {
      const priorityA = SOURCE_PRIORITY[a.source] ?? 0;
      const priorityB = SOURCE_PRIORITY[b.source] ?? 0;

      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      return b.confidence - a.confidence;
    });

    const winner = sorted[0];
    return this.createDecision(results, winner.entityType, winner.entitySubtype, 'highest_confidence');
  }

  private createDecision(
    extractionResults: ExtractionResult[],
    canonicalType: string,
    canonicalSubtype: string | undefined,
    resolutionReason: ReconciliationDecision['resolutionReason']
  ): ReconciliationDecision {
    return {
      extractionResults,
      canonicalType,
      canonicalSubtype,
      resolutionReason,
    };
  }

  async resolveAll(results: ExtractionResult[]): Promise<ReconciliationDecision[]> {
    const groups = this.groupByNormalizedText(results);
    const decisions: ReconciliationDecision[] = [];

    for (const groupResults of groups.values()) {
      const decision = await this.resolve(groupResults);
      decisions.push(decision);
    }

    return decisions;
  }

  applyUserOverride(
    results: ExtractionResult[],
    override: EntityTypeOverride
  ): ReconciliationDecision {
    return this.createDecision(results, override.entityType, override.entitySubtype, 'user_override');
  }
}

export const conflictResolver = new ConflictResolver();
