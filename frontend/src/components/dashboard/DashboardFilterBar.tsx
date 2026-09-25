import { useTranslation } from 'react-i18next';
import { useDashboardFilters } from '../../hooks/useDashboardFilters';
import { useDebounce } from '../../hooks/useDebounce';
import { useEffect, useState } from 'react';

/**
 * Implements exactly the seven fields on the backend's actual
 * DashboardFiltersDto (dateFrom, dateTo, departmentId, employeeId,
 * customerId, projectId, status, priority) — no more, no fewer.
 *
 * The four ID filters (department/employee/customer/project) are
 * plain UUID text inputs, not resource-picker dropdowns —
 * deliberately, since a proper picker would need to fetch from
 * Administration/CRM list endpoints, which risks pulling those
 * modules' functionality into this Dashboard-only phase (flagged
 * as an assumption in the Phase 3B report, instruction 19's
 * "stop and report" spirit). They're debounced since they're
 * free-typed; date/status/priority fire on change directly.
 */
export function DashboardFilterBar() {
  const { t } = useTranslation('dashboard');
  const { filters, setFilter, clearFilters } = useDashboardFilters();
  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3">
      <DateField label={t('filters.dateFrom')} value={filters.dateFrom} onChange={(v) => setFilter('dateFrom', v)} />
      <DateField label={t('filters.dateTo')} value={filters.dateTo} onChange={(v) => setFilter('dateTo', v)} />
      <IdField
        label={t('filters.departmentId')}
        value={filters.departmentId}
        onChange={(v) => setFilter('departmentId', v)}
      />
      <IdField label={t('filters.employeeId')} value={filters.employeeId} onChange={(v) => setFilter('employeeId', v)} />
      <IdField label={t('filters.customerId')} value={filters.customerId} onChange={(v) => setFilter('customerId', v)} />
      <IdField label={t('filters.projectId')} value={filters.projectId} onChange={(v) => setFilter('projectId', v)} />
      <TextField label={t('filters.status')} value={filters.status} onChange={(v) => setFilter('status', v)} />
      <SelectField
        label={t('filters.priority')}
        value={filters.priority}
        onChange={(v) => setFilter('priority', v)}
        options={['low', 'medium', 'high', 'urgent']}
      />
      {hasActiveFilters && (
        <button type="button" onClick={clearFilters} className="text-xs font-medium text-primary hover:underline">
          {t('filters.clear')}
        </button>
      )}
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      {label}
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
      />
    </label>
  );
}

function IdField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  const [draft, setDraft] = useState(value ?? '');
  const debounced = useDebounce(draft, 400);

  useEffect(() => {
    if (debounced !== (value ?? '')) onChange(debounced || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => setDraft(value ?? ''), [value]);

  return (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      {label}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="uuid"
        className="w-36 rounded border border-border bg-surface px-2 py-1.5 font-mono text-xs text-ink"
      />
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      {label}
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-32 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
  options: string[];
}) {
  const { t } = useTranslation('common');
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      {label}
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {t(`priority.${opt}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
