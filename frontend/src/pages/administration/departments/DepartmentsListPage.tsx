import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from '../../../api/queries/useDepartments';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { DepartmentFormModal, type DepartmentFormValues } from './DepartmentFormModal';
import type { Department } from '../../../types/entities/administration';

/**
 * Edit and delete stay modal-based here rather than moving to the
 * detail page — the detail page (DepartmentDetailPage) exists
 * specifically to show which employees belong to a department,
 * which this flat list has no room for; it is not itself a
 * richer CRUD surface, so editing/deleting a row from the list is
 * still the fastest path and stays in place.
 */
export function DepartmentsListPage() {
  const { t } = useTranslation(['departments', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Department | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Department | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, error } = useDepartments({ page, pageSize: 20, search: search || undefined });
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment(editing?.id ?? '');
  const deleteMutation = useDeleteDepartment();

  const columns: Array<DataTableColumn<Department>> = [
    { key: 'name', headerKey: 'departments:columns.name', render: (d) => d.name },
    { key: 'status', headerKey: 'departments:columns.status', render: (d) => t(`departments:status.${d.status}`) },
    { key: 'managerId', headerKey: 'departments:columns.managerId', render: (d) => (d.manager ? `${d.manager.firstName} ${d.manager.lastName}` : '—') },
    {
      key: 'actions',
      headerKey: 'common:action.edit',
      render: (d) => (
        <div className="flex gap-3">
          <PermissionGate requires={PERMISSIONS.Administration.departments.edit}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEditing(d); setFormError(null); setModalMode('edit'); }}
              className="text-xs font-medium text-primary hover:underline"
            >
              {t('common:action.edit')}
            </button>
          </PermissionGate>
          <PermissionGate requires={PERMISSIONS.Administration.departments.delete}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDeleteError(null); setConfirmDelete(d); }}
              className="text-xs font-medium text-danger hover:underline"
            >
              {t('common:action.delete')}
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('departments:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Administration.departments.create}>
            <button
              type="button"
              onClick={() => { setEditing(null); setFormError(null); setModalMode('create'); }}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90"
            >
              {t('departments:action.create')}
            </button>
          </PermissionGate>
        }
      />

      <div className="mb-4">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(d) => d.id}
        onRowClick={(d) => navigate(`/admin/departments/${d.id}`)}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('departments:empty.title')}
        emptyDescription={t('departments:empty.description')}
      />

      <DepartmentFormModal
        open={modalMode !== null}
        onOpenChange={(open) => { if (!open) { setModalMode(null); setFormError(null); } }}
        mode={modalMode ?? 'create'}
        initialValues={editing ?? undefined}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        submitError={formError}
        onSubmit={(values: DepartmentFormValues) => {
          setFormError(null);
          const payload = { ...values, managerId: values.managerId || undefined };
          const onError = (err: unknown) => setFormError(err instanceof ApiError ? err.message : t('common:error.generic'));
          if (modalMode === 'edit' && editing) {
            updateMutation.mutate(payload, { onSuccess: () => setModalMode(null), onError });
          } else {
            createMutation.mutate(payload, { onSuccess: () => setModalMode(null), onError });
          }
        }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={t('departments:detail.deleteTitle')}
        message={t('departments:detail.deleteMessage', { name: confirmDelete?.name ?? '' })}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          confirmDelete &&
          deleteMutation.mutate(confirmDelete.id, {
            onSuccess: () => setConfirmDelete(null),
            // Active-employee deletion protection surfaces here
            // verbatim (409/422 from the backend), never predicted
            // client-side — the list has no employee-count field
            // to check against ahead of time.
            onError: (err) => {
              setConfirmDelete(null);
              setDeleteError(err instanceof ApiError ? err.message : t('common:error.generic'));
            },
          })
        }
      />
      {deleteError && <p className="mt-2 text-sm text-danger" role="alert">{deleteError}</p>}
    </div>
  );
}
