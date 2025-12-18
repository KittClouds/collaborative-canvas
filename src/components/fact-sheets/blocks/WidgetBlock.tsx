import React from 'react';
import { WidgetBlockConfig } from '@/lib/widgets/types';
import { getWidget } from '@/lib/widgets/registry';

interface WidgetBlockProps {
  config: WidgetBlockConfig;
  entity: any;
}

/**
 * Resolve bindings by extracting values from entity
 */
function resolveBinding(entity: any, path: string, defaultValue?: any): any {
  if (!entity || !path) {
    return defaultValue;
  }

  const parts = path.split('.');
  let current = entity;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[part];
  }

  return current !== undefined ? current : defaultValue;
}

/**
 * Apply transformations to values
 */
function applyTransform(value: any, transform?: string): any {
  if (!transform) {
    return value;
  }

  switch (transform) {
    case 'toNumber':
      return Number(value) || 0;
    
    case 'toPercent':
      return Number(value) * 100;
    
    case 'toString':
      return String(value);
    
    case 'toArray':
      return Array.isArray(value) ? value : [];
    
    case 'toBoolean':
      return Boolean(value);
    
    default:
      console.warn(`Unknown transform: ${transform}`);
      return value;
  }
}

/**
 * WidgetBlock component
 * Renders a widget with resolved bindings from entity data
 */
export const WidgetBlock: React.FC<WidgetBlockProps> = ({ config, entity }) => {
  const widget = getWidget(config.widgetId);

  if (!widget) {
    return (
      <div className="p-4 rounded-lg border border-destructive bg-destructive/10 text-destructive">
        <p className="text-sm font-medium">Widget not found: {config.widgetId}</p>
      </div>
    );
  }

  // Start with widget default props
  const props = { ...widget.defaultProps };

  // Merge static props from config
  if (config.props) {
    Object.assign(props, config.props);
  }

  // Resolve and merge bindings
  if (config.bindings) {
    for (const [propName, binding] of Object.entries(config.bindings)) {
      const rawValue = resolveBinding(entity, binding.path, binding.defaultValue);
      const transformedValue = applyTransform(rawValue, binding.transform);
      props[propName] = transformedValue;
    }
  }

  const WidgetComponent = widget.component;

  return (
    <div className="widget-block">
      {config.title && (
        <h3 className="text-lg font-semibold mb-2 text-foreground">
          {config.title}
        </h3>
      )}
      {config.description && (
        <p className="text-sm text-muted-foreground mb-4">
          {config.description}
        </p>
      )}
      <WidgetComponent {...props} />
    </div>
  );
};
