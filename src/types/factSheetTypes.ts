import { LucideIcon } from 'lucide-react';
import { EntityKind } from '@/lib/entities/entityTypes';

// Field type definitions
export interface BaseField {
  name: string;
  label: string;
  defaultValue?: any;
  placeholder?: string;
}

export interface TextField extends BaseField {
  type: 'text';
  multiline?: boolean;
}

export interface NumberField extends BaseField {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface DropdownField extends BaseField {
  type: 'dropdown';
  options: string[];
}

export interface ArrayField extends BaseField {
  type: 'array';
  itemType: 'text' | 'entity-link';
  addButtonText?: string;
}

export interface ProgressField extends BaseField {
  type: 'progress';
  currentField: string;
  maxField: string;
  color?: string;
}

export interface RelationshipField extends BaseField {
  type: 'relationship';
}

export interface StatGridField extends BaseField {
  type: 'stat-grid';
  stats: Array<{
    name: string;
    label: string;
    abbr: string;
  }>;
}

// ============================================
// EXTENDED FIELD TYPES (Phase 2)
// ============================================

/**
 * Slider field - for continuous value selection
 */
export interface SliderField extends BaseField {
  type: 'slider';
  min: number;
  max: number;
  step?: number;
  showValue?: boolean;
  color?: string;
  marks?: Array<{ value: number; label: string }>;
}

/**
 * Counter field - for discrete integer values with +/- buttons
 */
export interface CounterField extends BaseField {
  type: 'counter';
  min?: number;
  max?: number;
  step?: number;
  showButtons?: boolean;
}

/**
 * Toggle field - for boolean on/off values
 */
export interface ToggleField extends BaseField {
  type: 'toggle';
  onLabel?: string;
  offLabel?: string;
}

/**
 * Date field - fantasy calendar aware date picker
 */
export interface DateField extends BaseField {
  type: 'date';
  calendarId?: string; // Optional calendar system
  includeTime?: boolean;
  format?: string; // Display format
}

/**
 * Color field - color picker with palette support
 */
export interface ColorField extends BaseField {
  type: 'color';
  palette?: string[]; // Preset colors
  allowCustom?: boolean;
}

/**
 * Rating field - star/icon based rating
 */
export interface RatingField extends BaseField {
  type: 'rating';
  maxRating?: number; // Default 5
  icon?: 'star' | 'heart' | 'circle' | 'flame';
  allowHalf?: boolean;
  color?: string;
}

/**
 * Tags field - multi-value tag input with suggestions
 */
export interface TagsField extends BaseField {
  type: 'tags';
  suggestions?: string[];
  maxTags?: number;
  allowCustom?: boolean;
  color?: string; // Tag badge color
}

/**
 * Rich text field - formatted text with basic styling
 */
export interface RichTextField extends BaseField {
  type: 'rich-text';
  minHeight?: number;
  maxHeight?: number;
  toolbar?: ('bold' | 'italic' | 'underline' | 'link' | 'list')[];
}

/**
 * Entity link field - reference to another entity
 */
export interface EntityLinkField extends BaseField {
  type: 'entity-link';
  allowedKinds?: string[]; // Restrict to specific entity kinds
  multiple?: boolean;
}

// ============================================
// RELATIONSHIP-AWARE FIELD TYPES (Phase 3)
// Tightly coupled with Blueprint Hub
// ============================================

/**
 * Relationship slot field - connected to Blueprint Hub relationship types
 * Enables inline relationship creation from Fact Sheets
 */
export interface RelationshipSlotField extends BaseField {
  type: 'relationship-slot';

  /** Links to a specific Blueprint Hub RelationshipTypeDef */
  relationshipTypeId?: string;

  /** Alternative: allow multiple relationship types from Blueprint Hub */
  allowedRelationshipTypes?: string[];

  /** Direction filter for relationships */
  direction: 'outgoing' | 'incoming' | 'both';

  /** Target entity kinds filter (from Blueprint) */
  targetEntityKinds?: EntityKind[];

  /** Cardinality constraints */
  maxCount?: number;

  /** Whether to show "Add from Blueprint" picker */
  showBlueprintPicker?: boolean;

  /** Group label for organizing relationship slots */
  groupLabel?: string;
}

/**
 * Network membership field - shows which networks entity belongs to
 * Integrates with lib/networks for family trees, factions, etc.
 */
export interface NetworkMembershipField extends BaseField {
  type: 'network-membership';

  /** Filter by network kind */
  networkKinds?: string[];

  /** Show role in network */
  showRole?: boolean;

  /** Allow editing network memberships */
  editable?: boolean;
}

export type FactSheetField =
  | TextField
  | NumberField
  | DropdownField
  | ArrayField
  | ProgressField
  | RelationshipField
  | StatGridField
  // Extended field types
  | SliderField
  | CounterField
  | ToggleField
  | DateField
  | ColorField
  | RatingField
  | TagsField
  | RichTextField
  | EntityLinkField
  // Relationship-aware field types
  | RelationshipSlotField
  | NetworkMembershipField;


// Card definition
export interface FactSheetCard {
  id: string;
  title: string;
  icon: LucideIcon;
  gradient: string;
  fields: FactSheetField[];
}

// Complete entity schema
export interface EntityFactSheetSchema {
  entityKind: EntityKind;
  cards: FactSheetCard[];
}

// Entity attributes stored in note content
export interface EntityAttributes {
  [key: string]: any;
}

// Parsed entity from document content
export interface ParsedEntity {
  kind: EntityKind;
  subtype?: string;
  label: string;
  noteId?: string;
  attributes: EntityAttributes;
}
