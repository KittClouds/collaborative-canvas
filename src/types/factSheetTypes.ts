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

export type FactSheetField =
  | TextField
  | NumberField
  | DropdownField
  | ArrayField
  | ProgressField
  | RelationshipField
  | StatGridField;

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
