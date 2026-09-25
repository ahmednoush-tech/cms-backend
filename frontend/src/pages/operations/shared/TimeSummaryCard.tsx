import { useTranslation } from 'react-i18next';
import { useWorkOrderTimeSummary, useProjectTimeSummary } from '../../../api/queries/useTimeEntries';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';

interface TimeSummaryCardProps {
  type: 'workOrder' | 'project';
  id: string;
}

/**
 * A read-only rollup — logging/editing time entries always happens
 * at the Task level (TimeEntriesSection on TaskDetailPage); this
 * card just shows the aggregate for everything underneath a work
 * order or project, including tasks reached only indirectly
 * (a project's rollup includes tasks under its work orders too).
 */
export function TimeSummaryCard({ type, id }: TimeSummaryCardProps) {
  const { t } = useTranslation(['timeTracking']);
  const workOrderSummary = useWorkOrderTimeSummary(type === 'workOrder' ? id : undefined);
  const projectSummary = useProjectTimeSummary(type === 'project' ? id : undefined);
  const summary = type === 'workOrder' ? workOrderSummary.data : projectSummary.data;

  if (!summary) return null;

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-medium text-ink">{t('timeTracking:summary.title')}</p>
      <div className="flex gap-4 text-sm">
        <div>
          <p className="text-xs text-ink-muted">{t('timeTracking:summary.totalHours')}</p>
          <p className="font-semibold text-ink">{summary.totalHours}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('timeTracking:summary.billableHours')}</p>
          <p className="font-semibold text-ink">{summary.billableHours}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('timeTracking:summary.totalCost')}</p>
          <p className="font-semibold text-ink">
            {summary.totalCost !== null ? <FinancialValue value={summary.totalCost} /> : t('timeTracking:summary.costUnknown')}
          </p>
        </div>
      </div>
    </div>
  );
}
