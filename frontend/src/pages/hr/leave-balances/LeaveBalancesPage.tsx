import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLeaveBalances, useSetLeaveBalance, useLeaveTypes } from '../../../api/queries/useLeaveManagement';
import { useEmployees } from '../../../api/queries/useEmployees';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function LeaveBalancesPage() {
  const { t } = useTranslation(['hr', 'common']);
  const { data: employeesData } = useEmployees({ page: 1, pageSize: 500 });
  const { data: leaveTypes } = useLeaveTypes();

  const [employeeId, setEmployeeId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: balances, isLoading, error } = useLeaveBalances(employeeId || undefined, year);
  const setBalanceMutation = useSetLeaveBalance();

  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [allocatedDaysInput, setAllocatedDaysInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const balanceTrackedTypes = (leaveTypes ?? []).filter((lt) => lt.requiresBalance);

  const startEditing = (leaveTypeId: string, currentAllocated?: string) => {
    setEditingTypeId(leaveTypeId);
    setAllocatedDaysInput(currentAllocated ?? '');
    setFormError(null);
  };

  const handleSave = (leaveTypeId: string) => {
    setFormError(null);
    setBalanceMutation.mutate(
      { employeeId, leaveTypeId, year, allocatedDays: Number(allocatedDaysInput) },
      {
        onSuccess: () => setEditingTypeId(null),
        onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('hr:leaveBalances.title')} breadcrumb={t('hr:title')} />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">{t('hr:leaveBalances.description')}</p>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">{t('hr:leaveBalances.fields.employee')}</label>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(employeesData?.items ?? []).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">{t('hr:leaveBalances.fields.year')}</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-28 rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>
      </div>

      {!employeeId && <p className="text-sm text-ink-muted">{t('hr:leaveBalances.selectEmployeePrompt')}</p>}

      {employeeId && isLoading && <LoadingState />}
      {employeeId && error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}

      {employeeId && balances && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('hr:leaveBalances.fields.leaveType')}</th>
                <th className="p-3 text-start">{t('hr:leaveBalances.fields.allocated')}</th>
                <th className="p-3 text-start">{t('hr:leaveBalances.fields.used')}</th>
                <th className="p-3 text-start">{t('hr:leaveBalances.fields.remaining')}</th>
                <PermissionGate requires={PERMISSIONS.HR.leaveBalances.manage}>
                  <th className="p-3"></th>
                </PermissionGate>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {balanceTrackedTypes.map((lt) => {
                const existing = balances.find((b) => b.leaveTypeId === lt.id);
                const remaining = existing ? Number(existing.allocatedDays) - Number(existing.usedDays) : 0;
                const isEditing = editingTypeId === lt.id;
                return (
                  <tr key={lt.id}>
                    <td className="p-3 font-medium text-ink">{lt.name}</td>
                    <td className="p-3 text-ink">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          autoFocus
                          value={allocatedDaysInput}
                          onChange={(e) => setAllocatedDaysInput(e.target.value)}
                          className="w-24 rounded border border-border bg-surface px-2 py-1 text-sm text-ink"
                        />
                      ) : (
                        existing?.allocatedDays ?? '—'
                      )}
                    </td>
                    <td className="p-3 text-ink-muted">{existing?.usedDays ?? '0'}</td>
                    <td className="p-3 text-ink">{existing ? remaining : '—'}</td>
                    <PermissionGate requires={PERMISSIONS.HR.leaveBalances.manage}>
                      <td className="p-3 text-end">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingTypeId(null)} className="text-sm text-ink-muted hover:underline">
                              {t('common:action.cancel')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSave(lt.id)}
                              disabled={setBalanceMutation.isPending}
                              className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                            >
                              {t('common:action.save')}
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => startEditing(lt.id, existing?.allocatedDays)} className="text-sm font-medium text-primary hover:underline">
                            {existing ? t('hr:leaveBalances.action.edit') : t('hr:leaveBalances.action.set')}
                          </button>
                        )}
                      </td>
                    </PermissionGate>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {formError && <p className="border-t border-border bg-danger/10 p-3 text-sm text-danger" role="alert">{formError}</p>}
        </div>
      )}
    </div>
  );
}
