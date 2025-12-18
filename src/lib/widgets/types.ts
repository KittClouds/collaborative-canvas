/**
 * Widget System Types
 * Defines the contract for reusable data visualization widgets
 */

import { ReactNode } from 'react';

/**
 * Base widget definition
 */
export interface WidgetDef {
  id: string;
  name: string;
  description?: string;
  component: React.ComponentType<any>;
  defaultProps?: Record<string, any>;
}

/**
 * Binding configuration for extracting data from entities
 */
export interface WidgetBinding {
  /**
   * Path to extract value from entity
   * Examples: "attributes.progress", "stats.count", "name"
   */
  path: string;
  
  /**
   * Optional transformation function name
   * Examples: "toNumber", "toPercent", "toString"
   */
  transform?: string;
  
  /**
   * Default value if path doesn't exist
   */
  defaultValue?: any;
}

/**
 * Widget block configuration for fact sheets
 */
export interface WidgetBlockConfig {
  /**
   * Widget ID to render
   */
  widgetId: string;
  
  /**
   * Static props passed directly to widget
   */
  props?: Record<string, any>;
  
  /**
   * Bindings to extract values from entity and map to widget props
   */
  bindings?: Record<string, WidgetBinding>;
  
  /**
   * Optional title for the widget block
   */
  title?: string;
  
  /**
   * Optional description/help text
   */
  description?: string;
}

/**
 * Props for widget components
 */
export interface BaseWidgetProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Progress Bar Widget Props
 */
export interface ProgressBarWidgetProps extends BaseWidgetProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  color?: string;
  height?: number;
}

/**
 * Meter Stack Widget Props
 */
export interface MeterStackWidgetProps extends BaseWidgetProps {
  segments: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  total?: number;
  showLabels?: boolean;
  height?: number;
}

/**
 * Stats Grid Widget Props
 */
export interface StatsGridWidgetProps extends BaseWidgetProps {
  stats: Array<{
    label: string;
    value: ReactNode;
    description?: string;
    icon?: ReactNode;
  }>;
  columns?: number;
  gap?: number;
}
