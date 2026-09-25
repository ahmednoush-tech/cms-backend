import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useWorkOrder, useUpdateWorkOrderStatus, useAssignWorkOrder } from '../../../api/queries/useWorkOrders';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { PriorityBadge } from '../../../components/PriorityBadge/PriorityBadge';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { WORK_ORDER_TRANSITIONS, getNextStates } from '../../../lib/workflowTransitions';
import { getStatusLabelKey } from '../../../components/StatusBadge/statusMap';
import { AttachmentsSection } from '../../../components/AttachmentsSection/AttachmentsSection';
import { TimeSummaryCard } from '../shared/TimeSummaryCard';
import { ApiError } from '../../../api/client';

export function WorkOrderDetailPage() {
  const { t } = useTranslation(['workOrders', 'common']);
  const { id } = useParams<{ id: string }>();
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);

  const { data: workOrder, isLoading, error } = useWorkOrder(id);
  const statusMutation = useUpdateWorkOrderStatus(id!);
  const assignMutation = useAssignWorkOrder(id!);

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!workOrder) return null;

  const nextStates = getNextStates(WORK_ORDER_TRANSITIONS, workOrder.status);

  return (
    <div>
      <PageHeader title={workOrder.title} breadcrumb={t('workOrders:title')} />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge entity="workOrder" value={workOrder.status} />
        <PriorityBadge value={workOrder.priority} />
        <span className="text-xs text-ink-muted">{workOrder.workOrderNumber}</span>
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <Field label={t('workOrders:fields.description')} value={workOrder.description ?? '—'} />
        <Field label={t('workOrders:fields.dueDate')} value={workOrder.dueDate?.slice(0, 10) ?? '—'} />
        <Field label={t('workOrders:fields.assignedToEmployeeId')} value={workOrder.assignee ? `${workOrder.assignee.firstName} ${workOrder.assignee.lastName}` : t('workOrders:detail.unassigned')} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <PermissionGate requires="Operations:work_orders:edit">
          {nextStates.map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => { setStatusError(null); setConfirmStatus(next); }}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {t('workOrders:detail.moveTo', { status: t(`common:${getStatusLabelKey('workOrder', next)}`) })}
            </button>
          ))}
        </PermissionGate>
      </div>
      {statusError && <p className="mt-2 text-sm text-danger" role="alert">{statusError}</p>}

      <PermissionGate requires="Operations:work_orders:assign">
        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-medium text-ink">{t('workOrders:detail.assign')}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAssignError(null);
              assignMutation.mutate(
                { employeeId: assigneeId },
                { onSuccess: () => setAssigneeId(''), onError: (err) => setAssignError(err instanceof ApiError ? err.message : t('common:error.generic')) },
              );
            }}
            className="flex gap-2"
          >
            <input
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              placeholder={t('workOrders:detail.employeeIdPlaceholder')}
              className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink"
            />
            <button type="submit" disabled={assignMutation.isPending || !assigneeId} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('workOrders:detail.assignAction')}
            </button>
          </form>
          {assignError && <p className="mt-2 text-sm text-danger" role="alert">{assignError}</p>}
        </div>
      </PermissionGate>

      <ConfirmDialog
        open={!!confirmStatus}
        onOpenChange={(open) => !open && setConfirmStatus(null)}
        title={t('workOrders:detail.statusChangeTitle')}
        message={t('workOrders:detail.statusChangeMessage', { status: confirmStatus ? t(`common:${getStatusLabelKey('workOrder', confirmStatus)}`) : '' })}
        isLoading={statusMutation.isPending}
        onConfirm={() =>
          confirmStatus &&
          statusMutation.mutate(
            { status: confirmStatus as never },
            {
              onSuccess: () => setConfirmStatus(null),
              // Completion gating (Work Order needs all Tasks
              // completed/cancelled) surfaces here verbatim if 422'd.
              onError: (err) => {
                setConfirmStatus(null);
                setStatusError(err instanceof ApiError ? err.message : t('common:error.generic'));
              },
            },
          )
        }
      />

      <TimeSummaryCard type="workOrder" id={workOrder.id} />

      <div className="mt-4">
        <AttachmentsSection entityType="work_order" entityId={workOrder.id} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}
