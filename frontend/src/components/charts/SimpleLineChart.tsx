interface SimpleLineChartProps {
  points: Array<{ label: string; value: number }>;
  height?: number;
  formatValue?: (v: number) => string;
}

/**
 * Deliberately dependency-free — a simple SVG polyline rather than
 * pulling in a charting library for one trend line. If richer
 * charting is ever needed project-wide, revisit then; this keeps
 * the bundle and dependency list lean for now.
 */
export function SimpleLineChart({ points, height = 180, formatValue }: SimpleLineChartProps) {
  const width = Math.max(points.length * 60, 300);
  const padding = 32;
  const max = Math.max(...points.map((p) => p.value), 1);

  const coords = points.map((p, i) => {
    const x = padding + (i / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (p.value / max) * (height - padding * 2);
    return { ...p, x, y };
  });

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-border" />
        <path d={pathD} fill="none" stroke="currentColor" className="text-primary" strokeWidth={2} />
        {coords.map((c, i) => (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={3} className="fill-primary" />
            <text x={c.x} y={height - padding + 16} textAnchor="middle" className="fill-current text-[10px] text-ink-muted">
              {c.label}
            </text>
            <text x={c.x} y={c.y - 8} textAnchor="middle" className="fill-current text-[10px] text-ink">
              {formatValue ? formatValue(c.value) : c.value}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
