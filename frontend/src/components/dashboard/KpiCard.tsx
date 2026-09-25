import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
}

/**
 * Renders exactly one value the backend returned — never a
 * fallback of 0 for a missing/undefined field, since "undefined"
 * on the Summary response specifically means "you're not
 * authorized to see this," not "the value is zero" (instruction
 * 2). Callers must not render this card at all for an undefined
 * KPI — see DashboardSummaryPage.
 */
export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
