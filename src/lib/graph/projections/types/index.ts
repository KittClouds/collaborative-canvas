// Export all projection types
export * from './base';
export * from './obsidian';
export * from './entity';
export * from './concept';

import { ObsidianScope } from './obsidian';
import { EntityScope } from './entity';
import { ConceptScope } from './concept';

// Unified scope type for the BaseProjection
export type ProjectionScope = ObsidianScope | EntityScope | ConceptScope;
