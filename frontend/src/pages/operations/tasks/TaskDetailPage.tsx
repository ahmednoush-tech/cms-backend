import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useTask, useUpdateTaskStatus, useAssignTask } from '../../../api/queries/useTasks';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { PriorityBadge } from '../../../components/PriorityBadge/PriorityBadge';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { AttachmentsSection } from '../../../components/AttachmentsSection/AttachmentsSection';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { TASK_TRANSITIONS, getNextStates } from '../../../lib/workflowTransitions';
import { getStatusLabelKey } from '../../../components/StatusBadge/statusMap';
import { TimeEntriesSection } from './TimeEntriesSection';
import { ApiError } from '../../../api/client';

export function TaskDetailPage() {
  const { t } = useTranslation(['tasks', 'common']);
  const { id } = useParams<{ id: string }>();
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);

  const { data: task, isLoading, error } = useTask(id);
  const statusMutation = useUpdateTaskStatus(id!);
  const assignMutation = useAssignTask(id!);

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!task) return null;

  const nextStates = getNextStates(TASK_TRANSITIONS, task.status);

  return (
    <div>
      <PageHeader title={task.title} breadcrumb={t('tasks:title')} />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge entity="task" value={task.status} />
        <PriorityBadge value={task.priority} />
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <Field label={t('tasks:fields.description')} value={task.description ?? '—'} />
        <Field label={t('tasks:fields.dueDate')} value={task.dueDate?.slice(0, 10) ?? '—'} />
        <Field label={t('tasks:fields.projectId')} value={task.project ? `${task.project.projectNumber} — ${task.project.name}` : '—'} />
        <Field label={t('tasks:fields.workOrderId')} value={task.workOrder ? task.workOrder.workOrderNumber : '—'} />
        <Field label={t('tasks:fields.assignedToEmployeeId')} value={task.assignee ? `${task.assignee.firstName} ${task.assignee.lastName}` : t('tasks:detail.unassigned')} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <PermissionGate requires="Operations:tasks:edit">
          {nextStates.map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => { setStatusError(null); setConfirmStatus(next); }}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {t('tasks:detail.moveTo', { status: t(`common:${getStatusLabelKey('task', next)}`) })}
            </button>
          ))}
        </PermissionGate>
      </div>
      {statusError && <p className="mt-2 text-sm text-danger" role="alert">{statusError}</p>}

      <PermissionGate requires="Operations:tasks:assign">
        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-medium text-ink">{t('tasks:detail.assign')}</p>
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
              placeholder={t('tasks:detail.employeeIdPlaceholder')}
              className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink"
            />
            <button type="submit" disabled={assignMutation.isPending || !assigneeId} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('tasks:detail.assignAction')}
            </button>
          </form>
          {assignError && <p className="mt-2 text-sm text-danger" role="alert">{assignError}</p>}
        </div>
      </PermissionGate>

      <ConfirmDialog
        open={!!confirmStatus}
        onOpenChange={(open) => !open && setConfirmStatus(null)}
        title={t('tasks:detail.statusChangeTitle')}
        message={t('tasks:detail.statusChangeMessage', { status: confirmStatus ? t(`common:${getStatusLabelKey('task', confirmStatus)}`) : '' })}
        isLoading={statusMutation.isPending}
        onConfirm={() =>
          confirmStatus &&
          statusMutation.mutate(
            { status: confirmStatus as never },
            {
              onSuccess: () => setConfirmStatus(null),
              onError: (err) => {
                setConfirmStatus(null);
                setStatusError(err instanceof ApiError ? err.message : t('common:error.generic'));
              },
            },
          )
        }
      />

      <TimeEntriesSection taskId={task.id} />

      <div className="mt-4">
        <AttachmentsSection entityType="task" entityId={task.id} />
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
