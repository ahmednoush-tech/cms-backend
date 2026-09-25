import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useEmployees, useCreateEmployee } from '../../../api/queries/useEmployees';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { EmployeeFormModal, type EmployeeFormValues } from './EmployeeFormModal';
import type { Employee } from '../../../types/entities/administration';

export function EmployeesListPage() {
  const { t } = useTranslation(['employees', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isLoading, error } = useEmployees({ page, pageSize: 20, search: search || undefined });
  const createMutation = useCreateEmployee();

  const columns: Array<DataTableColumn<Employee>> = [
    { key: 'employeeNumber', headerKey: 'employees:columns.number', render: (e) => e.employeeNumber },
    { key: 'name', headerKey: 'employees:columns.name', render: (e) => `${e.firstName} ${e.lastName}` },
    { key: 'jobTitle', headerKey: 'employees:columns.jobTitle', render: (e) => e.jobTitle ?? '—' },
    { key: 'status', headerKey: 'employees:columns.status', render: (e) => t(`employees:status.${e.status}`) },
  ];

  return (
    <div>
      <PageHeader
        title={t('employees:title')}
        action={
          <div className="flex gap-2">
            <Link to="/admin/employees/expiring-iqamas" className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('employees:residency.expiringIqamasLink')}
            </Link>
            <PermissionGate requires={PERMISSIONS.Administration.employees.create}>
              <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
                {t('employees:action.create')}
              </button>
            </PermissionGate>
          </div>
        }
      />

      <div className="mb-4">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('employees:empty.title')}
        emptyDescription={t('employees:empty.description')}
        onRowClick={(e) => navigate(`/admin/employees/${e.id}`)}
      />

      <EmployeeFormModal
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateError(null); }}
        mode="create"
        isSubmitting={createMutation.isPending}
        submitError={createError}
        onSubmit={(values: EmployeeFormValues) => {
          setCreateError(null);
          createMutation.mutate(
            {
              ...values,
              departmentId: values.departmentId || undefined,
              email: values.email || undefined,
              managerId: values.managerId || undefined,
            },
            {
              onSuccess: (employee) => { setCreateOpen(false); navigate(`/admin/employees/${employee.id}`); },
              onError: (err) => setCreateError(err instanceof ApiError ? err.message : t('common:error.generic')),
            },
          );
        }}
      />
    </div>
  );
}
