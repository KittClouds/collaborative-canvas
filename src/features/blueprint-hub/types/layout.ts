import type { FieldDef, CompiledRelationshipType } from './index';
import type { WidgetBlockConfig } from '@/lib/widgets/types';

/**
 * Render block types for entity view layout
 */
export type RenderBlock = 
  | { type: 'field_group'; id: string; fields: FieldDef[] }
  | { type: 'widget'; id: string; config: WidgetBlockConfig }
  | { type: 'relationship'; id: string; definition: CompiledRelationshipType };

/**
 * Render section containing blocks
 */
export interface RenderSection {
  id: string;
  title: string;
  blocks: RenderBlock[];
}

/**
 * Section-level overrides for layout customization
 */
export interface SectionOverride {
  blockOrder?: string[]; // IDs of blocks in desired order
  hiddenBlocks?: string[]; // IDs of blocks to hide
  addedBlocks?: RenderBlock[]; // New blocks to append
}

/**
 * Layout overrides for merging template and user customizations
 */
export interface LayoutOverrides {
  sectionOrder?: string[]; // IDs of sections in desired order
  hiddenSections?: string[]; // IDs of sections to hide
  sections?: Record<string, SectionOverride>; // Section-specific overrides keyed by section ID
  addedSections?: RenderSection[]; // New sections to append
}
