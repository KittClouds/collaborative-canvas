export type ExtractionSource = 'regex' | 'ner' | 'llm' | 'title' | 'wikilink' | 'blueprint' | 'manual';

export interface ExtractionContext {
  sentence: string;
  offset: number;
  paragraphIndex?: number;
  noteId: string;
  noteTitle: string;
}

export interface ExtractionResult {
  extractionId: string;
  text: string;
  normalizedText: string;
  entityType: string;
  entitySubtype?: string;
  confidence: number;
  source: ExtractionSource;
  extractorVersion: string;
  context: ExtractionContext;
  timestamp: number;
  rawOutput?: unknown;
}

export interface ReconciliationDecision {
  extractionResults: ExtractionResult[];
  canonicalType: string;
  canonicalSubtype?: string;
  resolutionReason: 'user_override' | 'blueprint_match' | 'highest_confidence' | 'manual';
  existingEntityId?: string;
}

export interface EntityTypeOverride {
  id: string;
  normalizedText: string;
  entityType: string;
  entitySubtype?: string;
  createdAt: number;
  updatedAt: number;
  noteContext?: string;
}

export interface ReconciliationEvent {
  type: 'entityExtracted' | 'entityMerged' | 'entityTypeChanged' | 'entityDeleted';
  entityId: string;
  entityName: string;
  entityType: string;
  previousType?: string;
  source: ExtractionSource;
  noteId: string;
  timestamp: number;
}

export interface ConflictSummary {
  text: string;
  conflictingTypes: Array<{ type: string; source: string; confidence: number }>;
}

export interface ReconciliationReport {
  created: string[];
  merged: string[];
  conflicts: ConflictSummary[];
  skipped: string[];
}

export interface ReconciliationOptions {
  autoResolveConflicts?: boolean;
  mergeWithExisting?: boolean;
  dryRun?: boolean;
}
