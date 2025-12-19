export * from './types';
export * from './adapters';
export * from './utils';

import { GraphDataAdapter } from './adapters/GraphDataAdapter';

let _graphAdapter: GraphDataAdapter | null = null;

export function getGraphAdapter(): GraphDataAdapter {
  if (!_graphAdapter) {
    _graphAdapter = new GraphDataAdapter();
  }
  return _graphAdapter;
}

export function resetGraphAdapter(): void {
  if (_graphAdapter) {
    _graphAdapter.destroy();
    _graphAdapter = null;
  }
}
