import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTasks, useCreateTask } from '../../../api/queries/useTasks';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { FilterBar } from '../../../components/FilterBar/FilterBar';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { PriorityBadge } from '../../../components/PriorityBadge/PriorityBadge';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { TaskFormModal, type TaskFormValues } from './TaskFormModal';
import type { Task } from '../../../types/entities/task';

export function TasksListPage() {
  const { t } = useTranslation(['tasks', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState<string | undefined>();
  const [workOrderId, setWorkOrderId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [assignedToEmployeeId, setAssignedToEmployeeId] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isLoading, error } = useTasks({ page, pageSize: 20, search: search || undefined, projectId, workOrderId, status, assignedToEmployeeId });
  const createMutation = useCreateTask();

  const columns: Array<DataTableColumn<Task>> = [
    { key: 'title', headerKey: 'tasks:columns.title', render: (task) => task.title },
    { key: 'status', headerKey: 'tasks:columns.status', render: (task) => <StatusBadge entity="task" value={task.status} /> },
    { key: 'priority', headerKey: 'tasks:columns.priority', render: (task) => <PriorityBadge value={task.priority} /> },
    { key: 'dueDate', headerKey: 'tasks:columns.dueDate', render: (task) => task.dueDate?.slice(0, 10) ?? '—' },
  ];

  return (
    <div>
      <PageHeader
        title={t('tasks:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Operations.tasks.create}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('tasks:action.create')}
            </button>
          </PermissionGate>
        }
      />

      <div className="mb-4">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
      </div>

      <FilterBar
        fields={[
          { key: 'projectId', labelKey: 'tasks:filters.projectId', type: 'text' },
          { key: 'workOrderId', labelKey: 'tasks:filters.workOrderId', type: 'text' },
          {
            key: 'status',
            labelKey: 'tasks:filters.status',
            type: 'select',
            options: ['pending', 'in_progress', 'completed', 'cancelled'].map((s) => ({
              value: s,
              labelKey: `common:status.task.${s}`,
            })),
          },
          { key: 'assignedToEmployeeId', labelKey: 'tasks:filters.assignedToEmployeeId', type: 'text' },
        ]}
        values={{ projectId, workOrderId, status, assignedToEmployeeId }}
        onChange={(key, value) => {
          setPage(1);
          if (key === 'projectId') setProjectId(value);
          if (key === 'workOrderId') setWorkOrderId(value);
          if (key === 'status') setStatus(value);
          if (key === 'assignedToEmployeeId') setAssignedToEmployeeId(value);
        }}
        onClear={() => { setProjectId(undefined); setWorkOrderId(undefined); setStatus(undefined); setAssignedToEmployeeId(undefined); setPage(1); }}
      />

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(task) => task.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('tasks:empty.title')}
        emptyDescription={t('tasks:empty.description')}
        onRowClick={(task) => navigate(`/ops/tasks/${task.id}`)}
      />

      <TaskFormModal
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateError(null); }}
        isSubmitting={createMutation.isPending}
        submitError={createError}
        onSubmit={(values: TaskFormValues) => {
          setCreateError(null);
          createMutation.mutate(
            {
              ...values,
              projectId: values.projectId || undefined,
              workOrderId: values.workOrderId || undefined,
              assignedToEmployeeId: values.assignedToEmployeeId || undefined,
            },
            {
              onSuccess: (task) => { setCreateOpen(false); navigate(`/ops/tasks/${task.id}`); },
              onError: (err) => setCreateError(err instanceof ApiError ? err.message : t('common:error.generic')),
            },
          );
        }}
      />
    </div>
  );
}
