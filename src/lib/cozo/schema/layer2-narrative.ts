export const NARRATIVE_HIERARCHY_SCHEMA = `
:create narrative_hierarchy {
    id: Uuid,
    parent_id: Uuid,
    child_id: Uuid,
    parent_kind: String,
    child_kind: String,
    sequence_order: Int? default null,
    created_at: Float default now()
}
`;

export const CAUSAL_LINK_SCHEMA = `
:create causal_link {
    id: Uuid,
    trigger_event_id: Uuid,
    caused_event_id: Uuid,
    causal_type: String default "triggers",
    confidence: Float default 1.0,
    created_at: Float default now()
}
`;

export const NARRATIVE_SCHEMA = `
${NARRATIVE_HIERARCHY_SCHEMA}
${CAUSAL_LINK_SCHEMA}
`;

export const NARRATIVE_HIERARCHY_RULES = {
  NARRATIVE: ['ARC', 'ACT', 'CHAPTER', 'SCENE', 'EVENT'],
  ARC: ['ACT', 'CHAPTER', 'SCENE'],
  ACT: ['CHAPTER', 'SCENE'],
  CHAPTER: ['SCENE'],
  SCENE: ['BEAT', 'EVENT'],
  BEAT: [],
  EVENT: ['EVENT'],
  TIMELINE: [],
} as const;

export const NARRATIVE_QUERIES = {
  upsertHierarchy: `
    ?[id, parent_id, child_id, parent_kind, child_kind, sequence_order, created_at] <- 
      [[$id, $parent_id, $child_id, $parent_kind, $child_kind, $sequence_order, $created_at]]
    :put narrative_hierarchy {
      id, parent_id, child_id, parent_kind, child_kind, sequence_order, created_at
    }
  `,

  getChildren: `
    ?[child_id, child_kind, sequence_order] := 
      *narrative_hierarchy{parent_id, child_id, child_kind, sequence_order},
      parent_id == $parent_id
    :order sequence_order
  `,

  getChildrenWithDetails: `
    ?[child_id, child_name, child_kind, child_subtype, sequence_order] := 
      *narrative_hierarchy{parent_id, child_id, child_kind, sequence_order},
      *entity{id: child_id, name: child_name, entity_subtype: child_subtype},
      parent_id == $parent_id
    :order sequence_order
  `,

  getParent: `
    ?[parent_id, parent_kind] := 
      *narrative_hierarchy{parent_id, child_id, parent_kind},
      child_id == $child_id
  `,

  getParentWithDetails: `
    ?[parent_id, parent_name, parent_kind, parent_subtype] := 
      *narrative_hierarchy{parent_id, child_id, parent_kind},
      *entity{id: parent_id, name: parent_name, entity_subtype: parent_subtype},
      child_id == $child_id
  `,

  getAncestors: `
    ancestors[child_id, ancestor_id, depth] := 
      *narrative_hierarchy{parent_id: ancestor_id, child_id},
      depth = 1
    
    ancestors[child_id, ancestor_id, depth] := 
      *narrative_hierarchy{parent_id, child_id},
      ancestors[parent_id, ancestor_id, d],
      depth = d + 1
    
    ?[ancestor_id, ancestor_name, ancestor_kind, depth] := 
      ancestors[$child_id, ancestor_id, depth],
      *entity{id: ancestor_id, name: ancestor_name, entity_kind: ancestor_kind}
    :order depth
  `,

  getDescendants: `
    descendants[parent_id, descendant_id, depth] := 
      *narrative_hierarchy{parent_id, child_id: descendant_id},
      depth = 1
    
    descendants[parent_id, descendant_id, depth] := 
      *narrative_hierarchy{parent_id, child_id},
      descendants[child_id, descendant_id, d],
      depth = d + 1
    
    ?[descendant_id, descendant_name, descendant_kind, depth] := 
      descendants[$parent_id, descendant_id, depth],
      *entity{id: descendant_id, name: descendant_name, entity_kind: descendant_kind}
    :order depth
  `,

  getSiblings: `
    ?[sibling_id, sibling_name, sibling_kind, sequence_order] := 
      *narrative_hierarchy{parent_id, child_id: $child_id},
      *narrative_hierarchy{parent_id, child_id: sibling_id, child_kind: sibling_kind, sequence_order},
      *entity{id: sibling_id, name: sibling_name},
      sibling_id != $child_id
    :order sequence_order
  `,

  updateSequence: `
    ?[id, sequence_order] <- [[$id, $sequence_order]]
    :update narrative_hierarchy { id => sequence_order }
  `,

  reorderChildren: `
    ?[id, sequence_order] <- $reorder_list
    :update narrative_hierarchy { id => sequence_order }
  `,

  deleteHierarchy: `
    ?[id] <- [[$id]]
    :rm narrative_hierarchy { id }
  `,

  deleteChildLink: `
    ?[id] := 
      *narrative_hierarchy{id, parent_id, child_id},
      parent_id == $parent_id,
      child_id == $child_id
    :rm narrative_hierarchy { id }
  `,

  upsertCausalLink: `
    ?[id, trigger_event_id, caused_event_id, causal_type, confidence, created_at] <- 
      [[$id, $trigger_event_id, $caused_event_id, $causal_type, $confidence, $created_at]]
    :put causal_link {
      id, trigger_event_id, caused_event_id, causal_type, confidence, created_at
    }
  `,

  getCauses: `
    ?[trigger_event_id, trigger_name, causal_type, confidence] := 
      *causal_link{trigger_event_id, caused_event_id, causal_type, confidence},
      *entity{id: trigger_event_id, name: trigger_name},
      caused_event_id == $event_id
  `,

  getEffects: `
    ?[caused_event_id, caused_name, causal_type, confidence] := 
      *causal_link{trigger_event_id, caused_event_id, causal_type, confidence},
      *entity{id: caused_event_id, name: caused_name},
      trigger_event_id == $event_id
  `,

  getCausalChain: `
    chain[event_id, next_event_id, depth] := 
      *causal_link{trigger_event_id: event_id, caused_event_id: next_event_id},
      depth = 1
    
    chain[event_id, next_event_id, depth] := 
      *causal_link{trigger_event_id: event_id, caused_event_id: mid_event},
      chain[mid_event, next_event_id, d],
      depth = d + 1
    
    ?[event_id, event_name, depth] := 
      chain[$start_event_id, event_id, depth],
      *entity{id: event_id, name: event_name}
    :order depth
    :limit $max_depth
  `,

  deleteCausalLink: `
    ?[id] <- [[$id]]
    :rm causal_link { id }
  `,

  deleteCausalLinkBetween: `
    ?[id] := 
      *causal_link{id, trigger_event_id, caused_event_id},
      trigger_event_id == $trigger_id,
      caused_event_id == $caused_id
    :rm causal_link { id }
  `,

  getFullNarrativeTree: `
    ?[parent_id, parent_name, parent_kind, child_id, child_name, child_kind, sequence_order] := 
      *narrative_hierarchy{parent_id, child_id, parent_kind, child_kind, sequence_order},
      *entity{id: parent_id, name: parent_name},
      *entity{id: child_id, name: child_name}
    :order parent_kind, sequence_order
  `,
};

export function isValidHierarchy(parentKind: string, childKind: string): boolean {
  const allowedChildren = NARRATIVE_HIERARCHY_RULES[parentKind as keyof typeof NARRATIVE_HIERARCHY_RULES];
  if (!allowedChildren) return false;
  return allowedChildren.includes(childKind as never);
}
