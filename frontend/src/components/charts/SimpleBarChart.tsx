interface SimpleBarChartProps {
  bars: Array<{ label: string; value: number }>;
  formatValue?: (v: number) => string;
}

/** Deliberately dependency-free — see SimpleLineChart's rationale. */
export function SimpleBarChart({ bars, formatValue }: SimpleBarChartProps) {
  const max = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="space-y-2">
      {bars.map((b, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-32 shrink-0 truncate text-ink-muted" title={b.label}>{b.label}</span>
          <div className="h-4 flex-1 rounded bg-surface-muted">
            <div className="h-4 rounded bg-primary" style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-end font-medium text-ink">{formatValue ? formatValue(b.value) : b.value}</span>
        </div>
      ))}
    </div>
  );
}
