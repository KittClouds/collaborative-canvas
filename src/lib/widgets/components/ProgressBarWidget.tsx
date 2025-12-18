import React from 'react';
import { ProgressBarWidgetProps } from '../types';

export const ProgressBarWidget: React.FC<ProgressBarWidgetProps> = ({
  value = 0,
  max = 100,
  label,
  showPercentage = true,
  color = 'hsl(var(--primary))',
  height = 20,
  className = '',
  style = {},
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  return (
    <div className={`w-full ${className}`} style={style}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {showPercentage && (
            <span className="text-sm text-muted-foreground">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div 
        className="w-full bg-secondary rounded-full overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <div
          className="h-full transition-all duration-300 ease-in-out rounded-full"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
};
