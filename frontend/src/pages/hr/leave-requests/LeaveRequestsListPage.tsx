import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useLeaveRequests,
  useCreateLeaveRequest,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
  useLeaveTypes,
} from '../../../api/queries/useLeaveManagement';
import { useEmployees } from '../../../api/queries/useEmployees';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { Modal } from '../../../components/Modal/Modal';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import type { LeaveRequestStatus } from '../../../types/entities/leave';

const STATUS_TABS: (LeaveRequestStatus | 'all')[] = ['pending', 'approved', 'rejected', 'cancelled', 'all'];

export function LeaveRequestsListPage() {
  const { t } = useTranslation(['hr', 'common']);
  const [statusFilter, setStatusFilter] = useState<LeaveRequestStatus | 'all'>('pending');
  const { data: requests, isLoading, error } = useLeaveRequests(statusFilter === 'all' ? {} : { status: statusFilter });

  const [createOpen, setCreateOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const approveMutation = useApproveLeaveRequest();
  const rejectMutation = useRejectLeaveRequest();

  return (
    <div>
      <PageHeader
        title={t('hr:leaveRequests.title')}
        breadcrumb={t('hr:title')}
        action={
          <PermissionGate requires={PERMISSIONS.HR.leaveRequests.create}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('hr:leaveRequests.action.new')}
            </button>
          </PermissionGate>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusFilter(tab)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              statusFilter === tab ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t(`hr:leaveRequests.status.${tab}`)}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}

      {requests && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('hr:leaveRequests.fields.employee')}</th>
                <th className="p-3 text-start">{t('hr:leaveRequests.fields.leaveType')}</th>
                <th className="p-3 text-start">{t('hr:leaveRequests.fields.dates')}</th>
                <th className="p-3 text-start">{t('hr:leaveRequests.fields.days')}</th>
                <th className="p-3 text-start">{t('hr:leaveRequests.fields.status')}</th>
                <PermissionGate requires={PERMISSIONS.HR.leaveRequests.approve}>
                  <th className="p-3"></th>
                </PermissionGate>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-ink-muted">{t('hr:leaveRequests.empty')}</td>
                </tr>
              )}
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 text-ink">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}</td>
                  <td className="p-3 text-ink">{r.leaveType?.name ?? '—'}</td>
                  <td className="p-3 text-ink-muted">{r.startDate.slice(0, 10)} → {r.endDate.slice(0, 10)}</td>
                  <td className="p-3 text-ink">{r.daysRequested}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === 'approved' ? 'bg-success/10 text-success' :
                      r.status === 'rejected' ? 'bg-danger/10 text-danger' :
                      r.status === 'cancelled' ? 'bg-surface-muted text-ink-muted' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {t(`hr:leaveRequests.status.${r.status}`)}
                    </span>
                  </td>
                  <PermissionGate requires={PERMISSIONS.HR.leaveRequests.approve}>
                    <td className="p-3 text-end">
                      {r.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => approveMutation.mutate(r.id)}
                            disabled={approveMutation.isPending}
                            className="text-sm font-medium text-success hover:underline disabled:opacity-50"
                          >
                            {t('hr:leaveRequests.action.approve')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectTarget(r.id)}
                            className="text-sm font-medium text-danger hover:underline"
                          >
                            {t('hr:leaveRequests.action.reject')}
                          </button>
                        </div>
                      )}
                    </td>
                  </PermissionGate>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateLeaveRequestModal open={createOpen} onOpenChange={setCreateOpen} />

      <Modal open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)} title={t('hr:leaveRequests.rejectTitle')}>
        <textarea
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder={t('hr:leaveRequests.fields.rejectionReason')}
          className="mb-3 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setRejectTarget(null)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button
            type="button"
            disabled={!rejectionReason || rejectMutation.isPending}
            onClick={() => {
              if (!rejectTarget) return;
              rejectMutation.mutate(
                { id: rejectTarget, input: { rejectionReason } },
                { onSuccess: () => { setRejectTarget(null); setRejectionReason(''); } },
              );
            }}
            className="rounded bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {t('hr:leaveRequests.action.reject')}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function CreateLeaveRequestModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation(['hr', 'common']);
  const { data: leaveTypes } = useLeaveTypes();
  const { data: employeesData } = useEmployees({ page: 1, pageSize: 500 });
  const createMutation = useCreateLeaveRequest();

  const [employeeId, setEmployeeId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const resetAndClose = () => {
    setEmployeeId('');
    setLeaveTypeId('');
    setStartDate('');
    setEndDate('');
    setReason('');
    setFormError(null);
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate(
      { employeeId, input: { leaveTypeId, startDate, endDate, reason: reason || undefined } },
      { onSuccess: resetAndClose, onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Something went wrong.') },
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && resetAndClose()} title={t('hr:leaveRequests.action.new')}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-ink-muted">{t('hr:leaveRequests.fields.employee')}</label>
          <select required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(employeesData?.items ?? []).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-ink-muted">{t('hr:leaveRequests.fields.leaveType')}</label>
          <select required value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(leaveTypes ?? []).map((lt) => (
              <option key={lt.id} value={lt.id}>{lt.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">{t('hr:leaveRequests.fields.startDate')}</label>
            <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">{t('hr:leaveRequests.fields.endDate')}</label>
            <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
          </div>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-ink-muted">{t('hr:leaveRequests.fields.reason')}</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </div>

        {formError && <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={resetAndClose} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {createMutation.isPending ? t('common:action.processing') : t('common:action.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
