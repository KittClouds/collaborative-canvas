export const COMMUNITY_SCHEMA = `
:create community {
    id: Uuid,
    group_id: String,
    scope_type: String default "vault",
    
    summary: String? default null,
    member_count: Int default 0,
    top_entities: [String] default [],
    
    created_at: Float default now(),
    computed_at: Float? default null
}
`;

export const COMMUNITY_MEMBER_SCHEMA = `
:create community_member {
    community_id: Uuid,
    entity_id: Uuid,
    membership_score: Float? default null,
    added_at: Float default now()
    =>
}
`;

export const GRAPH_STATS_SCHEMA = `
:create graph_stats {
    id: Uuid,
    scope_type: String,
    scope_id: String,
    group_id: String,
    
    entity_count: Int default 0,
    edge_count: Int default 0,
    episode_count: Int default 0,
    avg_degree: Float default 0.0,
    density: Float default 0.0,
    
    computed_at: Float default now()
}
`;

export const SCOPE_PROCESSING_STATE_SCHEMA = `
:create scope_processing_state {
    scope_type: String,
    scope_id: String,
    group_id: String,
    
    last_processed_at: Float? default null,
    status: String default "idle",
    progress_pct: Float default 0.0,
    current_step: String? default null,
    error_message: String? default null
    =>
}
`;

export const SCHEMA_VERSION_SCHEMA = `
:create schema_version {
    version: String,
    created_at: Float default now()
    =>
}
`;

export const ANALYTICS_SCHEMA = `
${COMMUNITY_SCHEMA}
${COMMUNITY_MEMBER_SCHEMA}
${GRAPH_STATS_SCHEMA}
${SCOPE_PROCESSING_STATE_SCHEMA}
${SCHEMA_VERSION_SCHEMA}
`;

export const ANALYTICS_QUERIES = {
  upsertCommunity: `
    ?[id, group_id, scope_type, summary, member_count, top_entities, created_at, computed_at] <- 
      [[$id, $group_id, $scope_type, $summary, $member_count, $top_entities, $created_at, $computed_at]]
    :put community {
      id, group_id, scope_type, summary, member_count, top_entities, created_at, computed_at
    }
  `,

  getCommunityById: `
    ?[id, group_id, scope_type, summary, member_count, top_entities, computed_at] := 
      *community{id, group_id, scope_type, summary, member_count, top_entities, computed_at},
      id == $id
  `,

  getCommunitiesByGroupId: `
    ?[id, summary, member_count, top_entities, computed_at] := 
      *community{id, group_id, summary, member_count, top_entities, computed_at},
      group_id == $group_id
    :order -member_count
  `,

  addCommunityMember: `
    ?[community_id, entity_id, membership_score, added_at] <- 
      [[$community_id, $entity_id, $membership_score, now()]]
    :put community_member { community_id, entity_id, membership_score, added_at }
  `,

  getCommunityMembers: `
    ?[entity_id, entity_name, entity_kind, membership_score] := 
      *community_member{community_id, entity_id, membership_score},
      *entity{id: entity_id, name: entity_name, entity_kind},
      community_id == $community_id
    :order -membership_score
  `,

  getEntityCommunity: `
    ?[community_id, summary, member_count] := 
      *community_member{community_id, entity_id},
      *community{id: community_id, summary, member_count},
      entity_id == $entity_id
  `,

  updateCommunityStats: `
    member_count[community_id, count] := 
      *community_member{community_id},
      count = count(community_id)
    
    ?[id, member_count, computed_at] := 
      *community{id},
      member_count[id, member_count],
      computed_at = now()
    :update community { id => member_count, computed_at }
  `,

  deleteCommunity: `
    ?[id] <- [[$id]]
    :rm community { id }
  `,

  deleteCommunityMembers: `
    ?[community_id, entity_id] := 
      *community_member{community_id, entity_id},
      community_id == $community_id
    :rm community_member { community_id, entity_id }
  `,

  upsertGraphStats: `
    ?[id, scope_type, scope_id, group_id, entity_count, edge_count, episode_count,
      avg_degree, density, computed_at] <- 
      [[$id, $scope_type, $scope_id, $group_id, $entity_count, $edge_count, $episode_count,
        $avg_degree, $density, now()]]
    :put graph_stats {
      id, scope_type, scope_id, group_id, entity_count, edge_count, episode_count,
      avg_degree, density, computed_at
    }
  `,

  getGraphStats: `
    ?[id, entity_count, edge_count, episode_count, avg_degree, density, computed_at] := 
      *graph_stats{id, group_id, entity_count, edge_count, episode_count, avg_degree, density, computed_at},
      group_id == $group_id
  `,

  getLatestGraphStats: `
    ?[scope_type, scope_id, entity_count, edge_count, episode_count, avg_degree, density, computed_at] := 
      *graph_stats{scope_type, scope_id, group_id, entity_count, edge_count, episode_count, 
        avg_degree, density, computed_at},
      group_id == $group_id
    :order -computed_at
    :limit 1
  `,

  computeGraphStats: `
    entity_count[group_id, count] := 
      *entity{group_id},
      count = count(group_id)
    
    edge_count[group_id, count] := 
      *entity_edge{group_id},
      count = count(group_id)
    
    episode_count[group_id, count] := 
      *episode{group_id},
      count = count(group_id)
    
    ?[group_id, entity_count, edge_count, episode_count] := 
      entity_count[group_id, entity_count],
      edge_count[group_id, edge_count],
      episode_count[group_id, episode_count]
  `,

  upsertProcessingState: `
    ?[scope_type, scope_id, group_id, last_processed_at, status, progress_pct, 
      current_step, error_message] <- 
      [[$scope_type, $scope_id, $group_id, $last_processed_at, $status, $progress_pct,
        $current_step, $error_message]]
    :put scope_processing_state {
      scope_type, scope_id, group_id => last_processed_at, status, progress_pct, 
      current_step, error_message
    }
  `,

  getProcessingState: `
    ?[last_processed_at, status, progress_pct, current_step, error_message] := 
      *scope_processing_state{scope_type, scope_id, group_id, last_processed_at, status,
        progress_pct, current_step, error_message},
      group_id == $group_id
  `,

  updateProcessingStatus: `
    ?[scope_type, scope_id, group_id, status, progress_pct, current_step] <- 
      [[$scope_type, $scope_id, $group_id, $status, $progress_pct, $current_step]]
    :update scope_processing_state { 
      scope_type, scope_id, group_id => status, progress_pct, current_step 
    }
  `,

  markProcessingComplete: `
    ?[scope_type, scope_id, group_id, last_processed_at, status, progress_pct] <- 
      [[$scope_type, $scope_id, $group_id, now(), "completed", 1.0]]
    :update scope_processing_state { 
      scope_type, scope_id, group_id => last_processed_at, status, progress_pct 
    }
  `,

  markProcessingFailed: `
    ?[scope_type, scope_id, group_id, status, error_message] <- 
      [[$scope_type, $scope_id, $group_id, "failed", $error_message]]
    :update scope_processing_state { 
      scope_type, scope_id, group_id => status, error_message 
    }
  `,

  getSchemaVersion: `
    ?[version, created_at] := 
      *schema_version{version, created_at}
    :order -created_at
    :limit 1
  `,

  setSchemaVersion: `
    ?[version, created_at] <- [[$version, now()]]
    :put schema_version { version, created_at }
  `,
};
