/**
 * Widget Registry
 * Central registry for all available widgets
 */

import { WidgetDef } from './types';
import { ProgressBarWidget } from './components/ProgressBarWidget';
import { MeterStackWidget } from './components/MeterStackWidget';
import { StatsGridWidget } from './components/StatsGridWidget';

const widgets = new Map<string, WidgetDef>();

/**
 * Register a widget in the registry
 */
function registerWidget(widget: WidgetDef): void {
  widgets.set(widget.id, widget);
}

/**
 * Get a widget by ID
 */
export function getWidget(id: string): WidgetDef | undefined {
  return widgets.get(id);
}

/**
 * Get all registered widgets
 */
export function getAllWidgets(): WidgetDef[] {
  return Array.from(widgets.values());
}

/**
 * Get all widget IDs
 */
export function getWidgetIds(): string[] {
  return Array.from(widgets.keys());
}

// Register built-in widgets
registerWidget({
  id: 'progress-bar',
  name: 'Progress Bar',
  description: 'Displays a progress bar with optional label and percentage',
  component: ProgressBarWidget,
  defaultProps: {
    value: 0,
    max: 100,
    showPercentage: true,
    height: 20,
  },
});

registerWidget({
  id: 'meter-stack',
  name: 'Meter Stack',
  description: 'Displays multiple segments as a stacked horizontal meter',
  component: MeterStackWidget,
  defaultProps: {
    segments: [],
    showLabels: true,
    height: 32,
  },
});

registerWidget({
  id: 'stats-grid',
  name: 'Stats Grid',
  description: 'Displays statistics in a responsive grid layout',
  component: StatsGridWidget,
  defaultProps: {
    stats: [],
    columns: 3,
    gap: 16,
  },
});
