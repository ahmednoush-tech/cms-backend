import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useWorkOrders, useCreateWorkOrder } from '../../../api/queries/useWorkOrders';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { FilterBar } from '../../../components/FilterBar/FilterBar';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { PriorityBadge } from '../../../components/PriorityBadge/PriorityBadge';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { WorkOrderFormModal, type WorkOrderFormValues } from './WorkOrderFormModal';
import type { WorkOrder } from '../../../types/entities/workOrder';

export function WorkOrdersListPage() {
  const { t } = useTranslation(['workOrders', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [assignedToEmployeeId, setAssignedToEmployeeId] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isLoading, error } = useWorkOrders({ page, pageSize: 20, search: search || undefined, projectId, status, assignedToEmployeeId });
  const createMutation = useCreateWorkOrder();

  const columns: Array<DataTableColumn<WorkOrder>> = [
    { key: 'workOrderNumber', headerKey: 'workOrders:columns.number', render: (w) => w.workOrderNumber },
    { key: 'title', headerKey: 'workOrders:columns.title', render: (w) => w.title },
    { key: 'status', headerKey: 'workOrders:columns.status', render: (w) => <StatusBadge entity="workOrder" value={w.status} /> },
    { key: 'priority', headerKey: 'workOrders:columns.priority', render: (w) => <PriorityBadge value={w.priority} /> },
    { key: 'dueDate', headerKey: 'workOrders:columns.dueDate', render: (w) => w.dueDate?.slice(0, 10) ?? '—' },
  ];

  return (
    <div>
      <PageHeader
        title={t('workOrders:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Operations.workOrders.create}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('workOrders:action.create')}
            </button>
          </PermissionGate>
        }
      />

      <div className="mb-4">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
      </div>

      <FilterBar
        fields={[
          { key: 'projectId', labelKey: 'workOrders:filters.projectId', type: 'text' },
          {
            key: 'status',
            labelKey: 'workOrders:filters.status',
            type: 'select',
            options: ['new', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled'].map((s) => ({
              value: s,
              labelKey: `common:status.workOrder.${s}`,
            })),
          },
          { key: 'assignedToEmployeeId', labelKey: 'workOrders:filters.assignedToEmployeeId', type: 'text' },
        ]}
        values={{ projectId, status, assignedToEmployeeId }}
        onChange={(key, value) => {
          setPage(1);
          if (key === 'projectId') setProjectId(value);
          if (key === 'status') setStatus(value);
          if (key === 'assignedToEmployeeId') setAssignedToEmployeeId(value);
        }}
        onClear={() => { setProjectId(undefined); setStatus(undefined); setAssignedToEmployeeId(undefined); setPage(1); }}
      />

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(w) => w.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('workOrders:empty.title')}
        emptyDescription={t('workOrders:empty.description')}
        onRowClick={(w) => navigate(`/ops/work-orders/${w.id}`)}
      />

      <WorkOrderFormModal
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateError(null); }}
        isSubmitting={createMutation.isPending}
        submitError={createError}
        onSubmit={(values: WorkOrderFormValues) => {
          setCreateError(null);
          createMutation.mutate(
            { ...values, assignedToEmployeeId: values.assignedToEmployeeId || undefined },
            {
              onSuccess: (wo) => { setCreateOpen(false); navigate(`/ops/work-orders/${wo.id}`); },
              onError: (err) => setCreateError(err instanceof ApiError ? err.message : t('common:error.generic')),
            },
          );
        }}
      />
    </div>
  );
}
