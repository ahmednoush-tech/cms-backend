import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimeEntriesForTask, useTaskTimeSummary, useDeleteTimeEntry } from '../../../api/queries/useTimeEntries';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { LogTimeModal } from './LogTimeModal';
import type { TimeEntry } from '../../../types/entities/timeEntry';

export function TimeEntriesSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation(['timeTracking', 'common']);
  const { data: entries } = useTimeEntriesForTask(taskId);
  const { data: summary } = useTaskTimeSummary(taskId);
  const deleteMutation = useDeleteTimeEntry(taskId);

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="mt-6 rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">{t('timeTracking:section.title')}</p>
        <PermissionGate requires={PERMISSIONS.Operations.timeEntries.create}>
          <button
            type="button"
            onClick={() => { setEditingEntry(undefined); setActionError(null); setLogModalOpen(true); }}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t('timeTracking:section.logTime')}
          </button>
        </PermissionGate>
      </div>

      {summary && (
        <div className="mb-3 flex gap-4 rounded border border-border bg-surface-muted p-3 text-sm">
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
      )}

      {(!entries || entries.length === 0) && <p className="text-sm text-ink-muted">{t('timeTracking:section.empty')}</p>}

      {entries && entries.length > 0 && (
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border text-xs uppercase text-ink-muted">
            <tr>
              <th className="pb-2 text-start">{t('timeTracking:fields.entryDate')}</th>
              <th className="pb-2 text-start">{t('timeTracking:fields.employee')}</th>
              <th className="pb-2 text-start">{t('timeTracking:fields.hours')}</th>
              <th className="pb-2 text-start">{t('timeTracking:summary.totalCost')}</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="py-1.5">{entry.entryDate.slice(0, 10)}</td>
                <td className="py-1.5 text-ink-muted">{entry.employee ? `${entry.employee.firstName} ${entry.employee.lastName}` : '—'}</td>
                <td className="py-1.5">{entry.hours}{!entry.billable && <span className="ms-1 text-xs text-ink-muted">({t('timeTracking:fields.nonBillable')})</span>}</td>
                <td className="py-1.5">{entry.laborCost !== null ? <FinancialValue value={entry.laborCost} /> : '—'}</td>
                <td className="py-1.5 text-end">
                  <PermissionGate requires={PERMISSIONS.Operations.timeEntries.edit}>
                    <button type="button" onClick={() => { setEditingEntry(entry); setActionError(null); setLogModalOpen(true); }} className="me-2 text-xs font-medium text-primary hover:underline">
                      {t('common:action.edit')}
                    </button>
                  </PermissionGate>
                  <PermissionGate requires={PERMISSIONS.Operations.timeEntries.delete}>
                    <button type="button" onClick={() => { setActionError(null); setConfirmDeleteId(entry.id); }} className="text-xs font-medium text-danger hover:underline">
                      {t('common:action.delete')}
                    </button>
                  </PermissionGate>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {actionError && <p className="mt-2 text-sm text-danger" role="alert">{actionError}</p>}

      <LogTimeModal open={logModalOpen} onOpenChange={setLogModalOpen} taskId={taskId} editingEntry={editingEntry} />

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title={t('timeTracking:section.deleteConfirmTitle')}
        message={t('timeTracking:section.deleteConfirmMessage')}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          confirmDeleteId &&
          deleteMutation.mutate(confirmDeleteId, {
            onSuccess: () => setConfirmDeleteId(null),
            onError: (err) => { setConfirmDeleteId(null); setActionError(err instanceof ApiError ? err.message : t('common:error.generic')); },
          })
        }
      />
    </div>
  );
}
