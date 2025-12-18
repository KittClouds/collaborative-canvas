import React from 'react';
import { StatsGridWidgetProps } from '../types';

export const StatsGridWidget: React.FC<StatsGridWidgetProps> = ({
  stats = [],
  columns = 3,
  gap = 16,
  className = '',
  style = {},
}) => {
  if (stats.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`} style={style}>
        No stats available
      </div>
    );
  }

  return (
    <div
      className={`grid ${className}`}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
        ...style,
      }}
    >
      {stats.map((stat, index) => (
        <div
          key={index}
          className="flex flex-col gap-1 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            {stat.icon && (
              <div className="text-muted-foreground">{stat.icon}</div>
            )}
            <span className="text-sm font-medium text-muted-foreground">
              {stat.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {stat.value}
          </div>
          {stat.description && (
            <span className="text-xs text-muted-foreground">
              {stat.description}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
