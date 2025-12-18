import React from 'react';
import { MeterStackWidgetProps } from '../types';

const DEFAULT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export const MeterStackWidget: React.FC<MeterStackWidgetProps> = ({
  segments = [],
  total,
  showLabels = true,
  height = 32,
  className = '',
  style = {},
}) => {
  if (segments.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`} style={style}>
        No data available
      </div>
    );
  }

  const calculatedTotal = total ?? segments.reduce((sum, seg) => sum + (seg.value || 0), 0);
  
  if (calculatedTotal === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`} style={style}>
        No data available
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`} style={style}>
      <div 
        className="flex w-full rounded-lg overflow-hidden bg-secondary"
        style={{ height: `${height}px` }}
      >
        {segments.map((segment, index) => {
          const percentage = (segment.value / calculatedTotal) * 100;
          const color = segment.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
          
          if (percentage <= 0) return null;
          
          return (
            <div
              key={index}
              className="transition-all duration-300 ease-in-out flex items-center justify-center"
              style={{
                width: `${percentage}%`,
                backgroundColor: color,
              }}
              title={`${segment.label}: ${segment.value} (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      
      {showLabels && (
        <div className="flex flex-wrap gap-4 mt-3">
          {segments.map((segment, index) => {
            const color = segment.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
            const percentage = (segment.value / calculatedTotal) * 100;
            
            return (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-foreground">
                  {segment.label}: {segment.value}
                  <span className="text-muted-foreground ml-1">
                    ({percentage.toFixed(1)}%)
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
