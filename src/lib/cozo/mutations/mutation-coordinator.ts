import { cozoDb } from '../db';
import { calculateDelta, deltasConflict, type RecordDelta } from './delta-calculator';
import { generateId } from '@/lib/utils/ids';

export type MutationOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
export type MutationEntityType = 'ENTITY' | 'EDGE' | 'FOLDER' | 'NETWORK' | 'MEMBERSHIP' | 'RELATIONSHIP';
export type MutationStatus = 'PENDING' | 'APPLIED' | 'CONFLICTED' | 'FAILED' | 'REVERTED';

export interface MutationRequest {
  operation: MutationOperation;
  relation: string;
  entityType?: MutationEntityType;
  recordId: string;
  data: Record<string, unknown>;
  baseVersion?: number;
  sessionId: string;
  userId?: string;
  parentMutationId?: string;
}

export interface MutationResult {
  success: boolean;
  mutationId: string;
  recordId: string;
  conflicts?: string[];
  delta?: RecordDelta;
  version: number;
  error?: string;
}

export interface MutationLogEntry {
  id: string;
  timestamp: number;
  sessionId: string;
  userId?: string;
  operation: MutationOperation;
  relation: string;
  entityType?: MutationEntityType;
  recordId: string;
  beforeState?: unknown;
  afterState: unknown;
  delta: unknown;
  baseVersion?: number;
  conflictWith: string[];
  status: MutationStatus;
  appliedAt?: number;
  error?: string;
}

const SCHEMA_FIELD_MAP: Record<string, string[]> = {
  folder_hierarchy: [
    'id', 'parent_id', 'child_id', 'created_at', 'valid_at', 'invalid_at',
    'group_id', 'scope_type', 'edge_type', 'inverse_type',
    'parent_entity_kind', 'child_entity_kind', 'confidence', 'extraction_methods'
  ],
  network_instance: [
    'id', 'name', 'schema_id', 'network_kind', 'network_subtype',
    'root_folder_id', 'root_entity_id', 'namespace', 'description', 'tags',
    'member_count', 'relationship_count', 'max_depth',
    'created_at', 'updated_at', 'group_id', 'scope_type'
  ],
  network_membership: [
    'id', 'network_id', 'entity_id', 'role', 'joined_at', 'left_at',
    'is_root', 'depth_level', 'created_at', 'updated_at', 'group_id', 'extraction_methods'
  ],
  network_relationship: [
    'id', 'network_id', 'source_id', 'target_id', 'relationship_code', 'inverse_code',
    'start_date', 'end_date', 'strength', 'notes', 'attributes',
    'created_at', 'updated_at', 'group_id', 'scope_type', 'confidence', 'extraction_methods'
  ],
  entity: [
    'id', 'name', 'normalized_name', 'entity_kind', 'entity_subtype',
    'group_id', 'scope_type', 'created_at', 'extraction_method', 'summary',
    'aliases', 'canonical_note_id', 'frequency'
  ],
  entity_edge: [
    'id', 'source_id', 'target_id', 'created_at', 'valid_at', 'invalid_at',
    'group_id', 'scope_type', 'edge_type', 'fact', 'episode_ids', 'note_ids',
    'weight', 'pmi_score', 'confidence', 'extraction_methods'
  ],
};

export class MutationCoordinator {
  private sessionId: string;
  private userId?: string;
  private initialized = false;
  private mutationQueue: MutationRequest[] = [];
  private processing = false;

  constructor(sessionId?: string, userId?: string) {
    this.sessionId = sessionId || generateId();
    this.userId = userId;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await cozoDb.init();
      this.initialized = true;
      console.log('[MutationCoordinator] Initialized with session:', this.sessionId);
    } catch (err) {
      console.warn('[MutationCoordinator] Init failed:', err);
    }
  }

  setSession(sessionId: string, userId?: string): void {
    this.sessionId = sessionId;
    this.userId = userId;
  }

  async executeMutation(request: MutationRequest): Promise<MutationResult> {
    const mutationId = generateId();
    const timestamp = Date.now();

    if (!this.initialized) {
      await this.init();
    }

    if (!cozoDb.isReady()) {
      return {
        success: false,
        mutationId,
        recordId: request.recordId,
        version: -1,
        error: 'CozoDB not ready',
      };
    }

    try {
      const currentState = await this.fetchCurrentState(request.relation, request.recordId);
      const delta = calculateDelta(request.recordId, request.relation, currentState, request.data);
      const conflicts = await this.detectConflicts(request.recordId, delta, request.baseVersion);

      if (conflicts.length > 0) {
        await this.logMutation(mutationId, request, delta, 'CONFLICTED', timestamp, conflicts);

        return {
          success: false,
          mutationId,
          recordId: request.recordId,
          conflicts,
          delta,
          version: -1,
          error: 'Concurrent modification detected',
        };
      }

      await this.logMutation(mutationId, request, delta, 'PENDING', timestamp);
      const version = await this.applyToCozoDB(request);
      await this.markMutationApplied(mutationId, Date.now());

      return {
        success: true,
        mutationId,
        recordId: request.recordId,
        delta,
        version,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.markMutationFailed(mutationId, errorMessage);

      return {
        success: false,
        mutationId,
        recordId: request.recordId,
        error: errorMessage,
        version: -1,
      };
    }
  }

  async batchMutations(requests: MutationRequest[]): Promise<MutationResult[]> {
    const results: MutationResult[] = [];

    for (const request of requests) {
      const result = await this.executeMutation(request);
      results.push(result);

      if (!result.success && result.error !== 'Concurrent modification detected') {
        break;
      }
    }

    return results;
  }

  async upsert(
    relation: string,
    recordId: string,
    data: Record<string, unknown>,
    entityType?: MutationEntityType
  ): Promise<MutationResult> {
    return this.executeMutation({
      operation: 'UPSERT',
      relation,
      entityType,
      recordId,
      data: { id: recordId, ...data },
      sessionId: this.sessionId,
      userId: this.userId,
    });
  }

  async insert(
    relation: string,
    recordId: string,
    data: Record<string, unknown>,
    entityType?: MutationEntityType
  ): Promise<MutationResult> {
    return this.executeMutation({
      operation: 'INSERT',
      relation,
      entityType,
      recordId,
      data: { id: recordId, ...data },
      sessionId: this.sessionId,
      userId: this.userId,
    });
  }

  async update(
    relation: string,
    recordId: string,
    data: Record<string, unknown>,
    baseVersion?: number
  ): Promise<MutationResult> {
    return this.executeMutation({
      operation: 'UPDATE',
      relation,
      recordId,
      data: { id: recordId, ...data },
      baseVersion,
      sessionId: this.sessionId,
      userId: this.userId,
    });
  }

  async delete(relation: string, recordId: string): Promise<MutationResult> {
    return this.executeMutation({
      operation: 'DELETE',
      relation,
      recordId,
      data: { id: recordId },
      sessionId: this.sessionId,
      userId: this.userId,
    });
  }

  private async fetchCurrentState(relation: string, recordId: string): Promise<unknown> {
    try {
      const fields = SCHEMA_FIELD_MAP[relation];
      if (!fields) {
        return null;
      }

      const query = `
        ?[${fields.join(', ')}] := 
          *${relation}{${fields.join(', ')}},
          id == "${this.escape(recordId)}"
      `;

      const result = cozoDb.runQuery(query);

      if (result.ok === false || !result.rows || result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const obj: Record<string, unknown> = {};
      fields.forEach((field, index) => {
        obj[field] = row[index];
      });

      return obj;
    } catch {
      return null;
    }
  }

  private async detectConflicts(
    recordId: string,
    delta: RecordDelta,
    baseVersion?: number
  ): Promise<string[]> {
    try {
      const query = `
        ?[id, delta] :=
          *mutation_log{id, record_id, delta, status, base_version},
          record_id == "${this.escape(recordId)}",
          status == "PENDING"
      `;

      const result = cozoDb.runQuery(query);

      if (result.ok === false || !result.rows || result.rows.length === 0) {
        return [];
      }

      const conflicts: string[] = [];

      for (const row of result.rows) {
        const mutId = row[0] as string;
        const deltaJson = row[1] as string;

        try {
          const otherDelta = JSON.parse(deltaJson);
          const otherRecordDelta: RecordDelta = {
            recordId,
            relation: delta.relation,
            timestamp: 0,
            deltas: otherDelta,
            beforeSnapshot: null,
            afterSnapshot: null,
          };

          if (deltasConflict(delta, otherRecordDelta)) {
            conflicts.push(mutId);
          }
        } catch {
          continue;
        }
      }

      return conflicts;
    } catch {
      return [];
    }
  }

  private async logMutation(
    mutationId: string,
    request: MutationRequest,
    delta: RecordDelta,
    status: MutationStatus,
    timestamp: number,
    conflictsWith: string[] = []
  ): Promise<void> {
    try {
      const query = `
        ?[id, timestamp, session_id, user_id, operation, relation, entity_type,
          record_id, before_state, after_state, delta, base_version, status, conflict_with] <- [[
          "${mutationId}",
          ${timestamp},
          "${this.escape(request.sessionId)}",
          ${request.userId ? `"${this.escape(request.userId)}"` : 'null'},
          "${request.operation}",
          "${this.escape(request.relation)}",
          ${request.entityType ? `"${request.entityType}"` : 'null'},
          "${this.escape(request.recordId)}",
          ${delta.beforeSnapshot ? `${JSON.stringify(JSON.stringify(delta.beforeSnapshot))}` : 'null'},
          ${JSON.stringify(JSON.stringify(delta.afterSnapshot))},
          ${JSON.stringify(JSON.stringify(delta.deltas))},
          ${request.baseVersion ?? 'null'},
          "${status}",
          ${JSON.stringify(conflictsWith)}
        ]]
        :put mutation_log {
          id, timestamp, session_id, user_id, operation, relation, entity_type,
          record_id, before_state, after_state, delta, base_version, status, conflict_with
        }
      `;

      cozoDb.runQuery(query);
    } catch (err) {
      console.warn('[MutationCoordinator] Failed to log mutation:', err);
    }
  }

  private async applyToCozoDB(request: MutationRequest): Promise<number> {
    const { operation, relation, data } = request;
    let query = '';

    switch (operation) {
      case 'INSERT':
        query = this.buildInsertQuery(relation, data);
        break;
      case 'UPDATE':
        query = this.buildUpdateQuery(relation, data);
        break;
      case 'DELETE':
        query = this.buildDeleteQuery(relation, data);
        break;
      case 'UPSERT':
        query = this.buildUpsertQuery(relation, data);
        break;
    }

    const result = cozoDb.runQuery(query);

    if (result.ok === false) {
      throw new Error(`CozoDB mutation failed: ${result.message || 'Unknown error'}`);
    }

    return Date.now();
  }

  private buildInsertQuery(relation: string, data: Record<string, unknown>): string {
    const fields = Object.keys(data);
    const values = fields.map(k => this.formatValue(data[k])).join(', ');

    return `
      ?[${fields.join(', ')}] <- [[${values}]]
      :insert ${relation} { ${fields.join(', ')} }
    `;
  }

  private buildUpdateQuery(relation: string, data: Record<string, unknown>): string {
    const { id, ...updateFields } = data;
    const fields = Object.keys(updateFields);
    const values = fields.map(k => this.formatValue(updateFields[k])).join(', ');

    return `
      ?[id, ${fields.join(', ')}] <- [["${this.escape(String(id))}", ${values}]]
      :update ${relation} { id => ${fields.join(', ')} }
    `;
  }

  private buildDeleteQuery(relation: string, data: Record<string, unknown>): string {
    return `
      ?[id] <- [["${this.escape(String(data.id))}"]]
      :delete ${relation} { id }
    `;
  }

  private buildUpsertQuery(relation: string, data: Record<string, unknown>): string {
    const fields = Object.keys(data);
    const values = fields.map(k => this.formatValue(data[k])).join(', ');

    return `
      ?[${fields.join(', ')}] <- [[${values}]]
      :put ${relation} { ${fields.join(', ')} }
    `;
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return `"${this.escape(value)}"`;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    if (typeof value === 'object') {
      return JSON.stringify(JSON.stringify(value));
    }
    return String(value);
  }

  private async markMutationApplied(mutationId: string, timestamp: number): Promise<void> {
    try {
      cozoDb.runQuery(`
        ?[id, status, applied_at] <- [["${mutationId}", "APPLIED", ${timestamp}]]
        :update mutation_log { id => status, applied_at }
      `);
    } catch {
      // Ignore errors in marking - mutation was still applied
    }
  }

  private async markMutationFailed(mutationId: string, error: string): Promise<void> {
    try {
      cozoDb.runQuery(`
        ?[id, status, error] <- [["${mutationId}", "FAILED", "${this.escape(error)}"]]
        :update mutation_log { id => status, error }
      `);
    } catch {
      // Ignore
    }
  }

  async getMutationHistory(recordId: string, limit = 50): Promise<MutationLogEntry[]> {
    try {
      const query = `
        ?[id, timestamp, operation, session_id, user_id, delta, status, applied_at, error] :=
          *mutation_log{id, timestamp, operation, session_id, user_id, delta, status, applied_at, error, record_id},
          record_id == "${this.escape(recordId)}"
        :order -timestamp
        :limit ${limit}
      `;

      const result = cozoDb.runQuery(query);

      if (result.ok === false || !result.rows) {
        return [];
      }

      return result.rows.map(row => ({
        id: row[0] as string,
        timestamp: row[1] as number,
        operation: row[2] as MutationOperation,
        sessionId: row[3] as string,
        userId: row[4] as string | undefined,
        delta: JSON.parse(row[5] as string),
        status: row[6] as MutationStatus,
        appliedAt: row[7] as number | undefined,
        error: row[8] as string | undefined,
        recordId,
        relation: '',
        afterState: null,
        beforeState: null,
        conflictWith: [],
      }));
    } catch {
      return [];
    }
  }

  async getConflictedMutations(): Promise<MutationLogEntry[]> {
    try {
      const query = `
        ?[id, timestamp, operation, relation, record_id, conflict_with] :=
          *mutation_log{id, timestamp, operation, relation, record_id, conflict_with, status},
          status == "CONFLICTED"
        :order -timestamp
      `;

      const result = cozoDb.runQuery(query);

      if (result.ok === false || !result.rows) {
        return [];
      }

      return result.rows.map(row => ({
        id: row[0] as string,
        timestamp: row[1] as number,
        operation: row[2] as MutationOperation,
        relation: row[3] as string,
        recordId: row[4] as string,
        conflictWith: row[5] as string[],
        sessionId: '',
        status: 'CONFLICTED' as MutationStatus,
        afterState: null,
        delta: null,
      }));
    } catch {
      return [];
    }
  }

  private escape(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
}

export const mutationCoordinator = new MutationCoordinator();
