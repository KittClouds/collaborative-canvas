/**
 * Wiki Feature Index
 * Re-exports for clean imports.
 * Phase 2C: Scope-aware tools components.
 */
export { WikiPage } from './pages/WikiPage';
export { WikiLayout } from './components/WikiLayout';
export { WikiHome } from './components/WikiHome';
export { WikiCollections } from './components/WikiCollections';
export { WikiEntityPage } from './components/WikiEntityPage';
export { WikiWorldbuilding } from './components/WikiWorldbuilding';
export { WikiStoryBeats } from './components/WikiStoryBeats';
export { WikiPeekPanel } from './components/WikiPeekPanel';
export { WikiTimelines } from './components/WikiTimelines';
export { WikiRelationships } from './components/WikiRelationships';
export { WikiMedia } from './components/WikiMedia';

// Hooks
export { useWikiData } from './hooks/useWikiData';
export { useTimelineEvents } from './hooks/useTimelineEvents';
export { useMediaAggregator } from './hooks/useMediaAggregator';

// Types
export * from './types/wikiTypes';
