export const MUTATION_LOG_SCHEMA = `
:create mutation_log {
    id: Uuid,
    timestamp: Float,
    session_id: String,
    user_id: String? default null,
    
    operation: String,
    relation: String,
    entity_type: String? default null,
    
    record_id: String,
    before_state: Json? default null,
    after_state: Json,
    delta: Json,
    
    base_version: Int? default null,
    conflict_with: [String] default [],
    resolution_strategy: String? default null,
    resolved_by: String? default null,
    
    parent_mutation_id: Uuid? default null,
    causally_depends_on: [Uuid] default [],
    
    status: String default "PENDING",
    applied_at: Float? default null,
    reverted_at: Float? default null,
    error: String? default null
}
`;

export const MUTATION_LOG_QUERIES = {
  insert: `
    ?[id, timestamp, session_id, user_id, operation, relation, entity_type,
      record_id, before_state, after_state, delta, base_version, status] <-
    [[$id, $timestamp, $session_id, $user_id, $operation, $relation, $entity_type,
      $record_id, $before_state, $after_state, $delta, $base_version, $status]]
    
    :insert mutation_log {
      id, timestamp, session_id, user_id, operation, relation, entity_type,
      record_id, before_state, after_state, delta, base_version, status
    }
  `,

  getHistory: `
    ?[id, timestamp, operation, user_id, delta, status] :=
      *mutation_log{id, timestamp, operation, user_id, delta, record_id, status},
      record_id == $record_id
    :order timestamp
  `,

  getPending: `
    ?[id, timestamp, operation, relation, record_id, delta] :=
      *mutation_log{id, timestamp, operation, relation, record_id, delta, status},
      status == "PENDING"
    :order timestamp
  `,

  getPendingByRecord: `
    ?[id, timestamp, operation, delta, base_version] :=
      *mutation_log{id, timestamp, operation, delta, base_version, record_id, status},
      record_id == $record_id,
      status == "PENDING"
    :order timestamp
  `,

  getConflicted: `
    ?[id, timestamp, operation, relation, record_id, conflict_with] :=
      *mutation_log{id, timestamp, operation, relation, record_id, conflict_with, status},
      status == "CONFLICTED"
    :order timestamp
  `,

  markApplied: `
    ?[id, status, applied_at] <- [[$id, "APPLIED", $applied_at]]
    :update mutation_log { id => status, applied_at }
  `,

  markFailed: `
    ?[id, status, error] <- [[$id, "FAILED", $error]]
    :update mutation_log { id => status, error }
  `,

  markConflicted: `
    ?[id, status, conflict_with] <- [[$id, "CONFLICTED", $conflict_with]]
    :update mutation_log { id => status, conflict_with }
  `,

  markReverted: `
    ?[id, status, reverted_at] <- [[$id, "REVERTED", $reverted_at]]
    :update mutation_log { id => status, reverted_at }
  `,

  getBySession: `
    ?[id, timestamp, operation, relation, record_id, status] :=
      *mutation_log{id, timestamp, operation, relation, record_id, status, session_id},
      session_id == $session_id
    :order -timestamp
    :limit $limit
  `,

  getRecent: `
    ?[id, timestamp, operation, relation, record_id, status, user_id] :=
      *mutation_log{id, timestamp, operation, relation, record_id, status, user_id}
    :order -timestamp
    :limit $limit
  `,

  countByStatus: `
    ?[status, count] :=
      *mutation_log{status},
      count = count(status)
  `,

  deleteOlderThan: `
    ?[id] :=
      *mutation_log{id, timestamp, status},
      status == "APPLIED",
      timestamp < $cutoff
    :rm mutation_log { id }
  `,
};
