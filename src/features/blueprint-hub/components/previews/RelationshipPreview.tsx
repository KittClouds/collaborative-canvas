interface RelationshipPreviewProps {
  fromType: {
    display_name?: string;
    color?: string;
    icon?: string;
  };
  toType: {
    display_name?: string;
    color?: string;
    icon?: string;
  };
  relationship: {
    direction: 'directed' | 'undirected' | 'bidirectional';
    display_label?: string;
    inverse_label?: string;
  };
}

export function RelationshipPreview({ fromType, toType, relationship }: RelationshipPreviewProps) {
  const fromColor = fromType.color || '#8b5cf6';
  const toColor = toType.color || '#3b82f6';
  const fromName = fromType.display_name || 'Source';
  const toName = toType.display_name || 'Target';
  const label = relationship.display_label || 'relates to';
  const inverseLabel = relationship.inverse_label;
  const isDirected = relationship.direction === 'directed';
  const isBidirectional = relationship.direction === 'bidirectional';

  return (
    <div className="w-full bg-muted/30 rounded-lg p-6 border">
      <svg
        width="100%"
        height="160"
        viewBox="0 0 500 160"
        className="mx-auto"
        style={{ maxWidth: '500px' }}
      >
        {/* From Node */}
        <g transform="translate(50, 80)">
          <circle
            cx="0"
            cy="0"
            r="30"
            fill={fromColor}
            opacity="0.2"
            stroke={fromColor}
            strokeWidth="2"
          />
          <text
            x="0"
            y="5"
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="currentColor"
            className="fill-foreground"
          >
            {fromName}
          </text>
        </g>

        {/* Relationship Line */}
        <g>
          {/* Main line */}
          <line
            x1="80"
            y1="80"
            x2="420"
            y2="80"
            stroke="currentColor"
            strokeWidth="2"
            className="stroke-muted-foreground"
            strokeDasharray={relationship.direction === 'undirected' ? '5,5' : '0'}
          />

          {/* Forward arrow */}
          {(isDirected || isBidirectional) && (
            <polygon
              points="420,80 410,75 410,85"
              fill="currentColor"
              className="fill-muted-foreground"
            />
          )}

          {/* Backward arrow for bidirectional */}
          {isBidirectional && (
            <polygon
              points="80,80 90,75 90,85"
              fill="currentColor"
              className="fill-muted-foreground"
            />
          )}

          {/* Forward label */}
          <text
            x="250"
            y="65"
            textAnchor="middle"
            fontSize="11"
            fill="currentColor"
            className="fill-foreground font-medium"
          >
            {label}
          </text>

          {/* Inverse label for bidirectional */}
          {isBidirectional && inverseLabel && (
            <text
              x="250"
              y="100"
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              className="fill-muted-foreground italic"
            >
              {inverseLabel}
            </text>
          )}
        </g>

        {/* To Node */}
        <g transform="translate(450, 80)">
          <circle
            cx="0"
            cy="0"
            r="30"
            fill={toColor}
            opacity="0.2"
            stroke={toColor}
            strokeWidth="2"
          />
          <text
            x="0"
            y="5"
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="currentColor"
            className="fill-foreground"
          >
            {toName}
          </text>
        </g>
      </svg>

      {/* Legend */}
      <div className="mt-4 text-center text-xs text-muted-foreground">
        <span className="font-medium">{fromName}</span>
        {' '}{label}{' '}
        <span className="font-medium">{toName}</span>
        {isBidirectional && inverseLabel && (
          <>
            {' '}(and vice versa: <span className="italic">{inverseLabel}</span>)
          </>
        )}
      </div>
    </div>
  );
}
