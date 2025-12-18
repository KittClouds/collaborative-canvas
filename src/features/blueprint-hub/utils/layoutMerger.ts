import type { RenderSection, RenderBlock, LayoutOverrides } from '../types/layout';

/**
 * Merges template layout with user-defined layout overrides.
 * 
 * This function implements a "diff-based" merge strategy:
 * 1. Template sections are reordered/hidden based on overrides
 * 2. New sections from template remain visible (appended to end)
 * 3. User-added sections are preserved
 * 4. Block-level merging follows same pattern within each section
 * 
 * @param templateLayout - Base layout from entity type or view template
 * @param overrides - User customizations (reordering, hiding, additions)
 * @returns Merged layout sections
 */
export function mergeLayout(
  templateLayout: RenderSection[],
  overrides: LayoutOverrides
): RenderSection[] {
  const {
    sectionOrder = [],
    hiddenSections = [],
    sections: sectionOverrides = {},
    addedSections = [],
  } = overrides;

  // Build a map of template sections by ID for quick lookup
  const templateSectionMap = new Map<string, RenderSection>();
  for (const section of templateLayout) {
    templateSectionMap.set(section.id, section);
  }

  // Track which template sections have been placed
  const placedSectionIds = new Set<string>();

  // Result sections array
  const result: RenderSection[] = [];

  // 1. Apply section ordering
  for (const sectionId of sectionOrder) {
    const templateSection = templateSectionMap.get(sectionId);
    if (!templateSection) {
      // Section was user-added previously, will be handled by addedSections
      continue;
    }

    // Skip if hidden
    if (hiddenSections.includes(sectionId)) {
      placedSectionIds.add(sectionId);
      continue;
    }

    // Merge blocks for this section
    const mergedSection = mergeSectionBlocks(
      templateSection,
      sectionOverrides[sectionId]
    );

    result.push(mergedSection);
    placedSectionIds.add(sectionId);
  }

  // 2. Append template sections not yet placed (new sections from template updates)
  for (const section of templateLayout) {
    if (placedSectionIds.has(section.id)) {
      continue;
    }

    // Skip if hidden
    if (hiddenSections.includes(section.id)) {
      continue;
    }

    // Merge blocks for this section
    const mergedSection = mergeSectionBlocks(
      section,
      sectionOverrides[section.id]
    );

    result.push(mergedSection);
  }

  // 3. Append user-added sections
  for (const addedSection of addedSections) {
    // Skip if hidden
    if (hiddenSections.includes(addedSection.id)) {
      continue;
    }

    result.push(addedSection);
  }

  return result;
}

/**
 * Merges blocks within a section based on overrides
 */
function mergeSectionBlocks(
  templateSection: RenderSection,
  override?: {
    blockOrder?: string[];
    hiddenBlocks?: string[];
    addedBlocks?: RenderBlock[];
  }
): RenderSection {
  if (!override) {
    // No overrides, return as-is
    return templateSection;
  }

  const {
    blockOrder = [],
    hiddenBlocks = [],
    addedBlocks = [],
  } = override;

  // Build a map of template blocks by ID
  const templateBlockMap = new Map<string, RenderBlock>();
  for (const block of templateSection.blocks) {
    templateBlockMap.set(block.id, block);
  }

  // Track which template blocks have been placed
  const placedBlockIds = new Set<string>();

  // Result blocks array
  const mergedBlocks: RenderBlock[] = [];

  // 1. Apply block ordering
  for (const blockId of blockOrder) {
    const templateBlock = templateBlockMap.get(blockId);
    if (!templateBlock) {
      // Block was user-added previously, will be handled by addedBlocks
      continue;
    }

    // Skip if hidden
    if (hiddenBlocks.includes(blockId)) {
      placedBlockIds.add(blockId);
      continue;
    }

    mergedBlocks.push(templateBlock);
    placedBlockIds.add(blockId);
  }

  // 2. Append template blocks not yet placed (new blocks from template updates)
  for (const block of templateSection.blocks) {
    if (placedBlockIds.has(block.id)) {
      continue;
    }

    // Skip if hidden
    if (hiddenBlocks.includes(block.id)) {
      continue;
    }

    mergedBlocks.push(block);
  }

  // 3. Append user-added blocks
  for (const addedBlock of addedBlocks) {
    // Skip if hidden
    if (hiddenBlocks.includes(addedBlock.id)) {
      continue;
    }

    mergedBlocks.push(addedBlock);
  }

  return {
    ...templateSection,
    blocks: mergedBlocks,
  };
}
