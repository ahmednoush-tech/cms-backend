import { useTranslation } from 'react-i18next';
import { EmptyState } from '../EmptyState/EmptyState';
import type { EmployeeCountMap } from '../../types/dashboard';

interface WorkloadTableProps {
  openTasksByEmployee: EmployeeCountMap;
  openWorkOrdersByEmployee: EmployeeCountMap;
  totalOpenAssignmentsByEmployee: EmployeeCountMap;
}

/**
 * Preserves the backend's three-concept structure exactly
 * (instruction 5) — three explicit columns, not a single merged
 * "workload" number, so it's visible that Total is the SUM of the
 * other two, never a fourth independently-fetched figure.
 *
 * NOTE (flagged as an assumption in the Phase 3B report): the
 * backend's workload response is keyed by employeeId only — no
 * employee name is included (confirmed this session, re-reading
 * DashboardService.buildWorkload()). Resolving a name would
 * require calling GET /employees (Administration module), which
 * (a) is a different permission (Administration:employees:view)
 * that most Operations-workload viewers won't hold under the
 * current seeded RBAC, and (b) risks quietly expanding this
 * phase's scope into Administration. Rows are therefore labeled
 * by a shortened employeeId — an honest reflection of what the
 * API actually returns, not an invented field.
 */
export function WorkloadTable({
  openTasksByEmployee,
  openWorkOrdersByEmployee,
  totalOpenAssignmentsByEmployee,
}: WorkloadTableProps) {
  const { t } = useTranslation('dashboard');
  const employeeIds = Object.keys(totalOpenAssignmentsByEmployee);

  if (employeeIds.length === 0) {
    return <EmptyState title={t('workload.empty')} description={t('workload.emptyDescription')} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-start text-sm">
        <thead className="border-b border-border bg-surface-muted text-xs font-medium uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-2.5 text-start">{t('workload.employee')}</th>
            <th className="px-4 py-2.5 text-start">{t('workload.openTasks')}</th>
            <th className="px-4 py-2.5 text-start">{t('workload.openWorkOrders')}</th>
            <th className="px-4 py-2.5 text-start">{t('workload.totalAssignments')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {employeeIds.map((employeeId) => (
            <tr key={employeeId}>
              <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{employeeId.slice(0, 8)}…</td>
              <td className="px-4 py-2.5 text-ink">{openTasksByEmployee[employeeId] ?? 0}</td>
              <td className="px-4 py-2.5 text-ink">{openWorkOrdersByEmployee[employeeId] ?? 0}</td>
              <td className="px-4 py-2.5 font-medium text-ink">{totalOpenAssignmentsByEmployee[employeeId]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
