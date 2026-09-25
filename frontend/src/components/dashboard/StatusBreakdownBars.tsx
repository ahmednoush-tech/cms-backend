import { useTranslation } from 'react-i18next';
import type { StatusBreakdown } from '../../types/dashboard';
import type { StatusEntity } from '../StatusBadge/statusMap';
import { getStatusLabelKey, getPriorityLabelKey } from '../StatusBadge/statusMap';
import { EmptyState } from '../EmptyState/EmptyState';

interface StatusBreakdownBarsProps {
  data: StatusBreakdown;
  /** Either a status entity (uses statusMap's per-entity labels) or 'priority' (shared low/medium/high/urgent). */
  entity: StatusEntity | 'priority';
  title: string;
}

/**
 * A horizontal-bar breakdown chart — deliberately not built on a
 * charting library, since none is in the Phase 3A-approved
 * dependency set and pulling one in for this alone would be a
 * scope expansion instruction 19 asks to avoid unless necessary.
 * Every bucket the backend returns (already zero-filled for every
 * valid enum value, confirmed in dashboard.service.ts) is shown,
 * including zero-value buckets — this is what makes the backend's
 * zero-filling behavior visible at all (a bucket missing entirely
 * would look identical to a zero-count bucket otherwise).
 */
export function StatusBreakdownBars({ data, entity, title }: StatusBreakdownBarsProps) {
  const { t } = useTranslation('common');
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium text-ink">{title}</p>
        <EmptyState title={t('common:empty.noData')} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-medium text-ink">{title}</p>
      <div className="space-y-2">
        {entries.map(([key, count]) => {
          const labelKey = entity === 'priority' ? getPriorityLabelKey(key) : getStatusLabelKey(entity, key);
          const widthPct = total === 0 ? 0 : (count / max) * 100;
          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 truncate text-ink-muted">{t(labelKey)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${widthPct}%` }}
                  role="img"
                  aria-label={`${t(labelKey)}: ${count}`}
                />
              </div>
              <span className="w-8 shrink-0 text-end font-medium text-ink">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
