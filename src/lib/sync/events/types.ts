export type SyncEventType =
  | 'noteCreated'
  | 'noteUpdated'
  | 'noteDeleted'
  | 'folderCreated'
  | 'folderUpdated'
  | 'folderDeleted'
  | 'folderMoved'
  | 'entityExtracted'
  | 'entityMerged'
  | 'entityTypeChanged'
  | 'entityDeleted'
  | 'extractionStarted'
  | 'extractionCompleted'
  | 'reconciliationCompleted'
  | 'blueprintInstanceCreated'
  | 'blueprintInstanceUpdated'
  | 'blueprintInstanceValidationFailed'
  | 'relationshipExtracted'
  | 'graphProjectionRebuilt';

export interface SyncEvent<T = unknown> {
  type: SyncEventType;
  payload: T;
  timestamp: number;
  source: string;
}

export interface NoteEvent {
  noteId: string;
  title: string;
  folderId?: string | null;
}

export interface FolderEvent {
  folderId: string;
  name: string;
  parentId?: string | null;
}

export interface EntityEvent {
  entityId: string;
  entityName: string;
  entityType: string;
  noteId: string;
  source: string;
}

export interface ReconciliationCompletedEvent {
  noteId: string;
  created: number;
  merged: number;
  conflicts: number;
}

export interface BlueprintInstanceEvent {
  entityId: string;
  entityTypeId: string;
  blueprintId: string;
  noteId?: string;
}

export interface BlueprintValidationFailedEvent {
  entityTypeId: string;
  entityId?: string;
  name?: string;
  errors: Array<{ field: string; message: string; code: string }>;
}

export interface RelationshipExtractedEvent {
  edgeId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: string;
  confidence: number;
}

export interface GraphProjectionRebuiltEvent {
  nodeCount: number;
  edgeCount: number;
  highConfidenceNodes: number;
  highConfidenceEdges: number;
}
