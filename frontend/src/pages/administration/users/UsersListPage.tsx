import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAdminUsers, useCreateAdminUser } from '../../../api/queries/useAdminUsers';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { UserFormModal, type CreateUserFormValues } from './UserFormModal';
import type { AdminUser } from '../../../types/entities/administration';

export function UsersListPage() {
  const { t } = useTranslation(['users', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isLoading, error } = useAdminUsers({ page, pageSize: 20, search: search || undefined });
  const createMutation = useCreateAdminUser();

  const columns: Array<DataTableColumn<AdminUser>> = [
    { key: 'name', headerKey: 'users:columns.name', render: (u) => u.name },
    { key: 'email', headerKey: 'users:columns.email', render: (u) => u.email },
    { key: 'status', headerKey: 'users:columns.status', render: (u) => t(`users:status.${u.status}`) },
    { key: 'lastLoginAt', headerKey: 'users:columns.lastLogin', render: (u) => u.lastLoginAt?.slice(0, 10) ?? t('users:columns.never') },
  ];

  return (
    <div>
      <PageHeader
        title={t('users:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Administration.users.create}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('users:action.create')}
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
        rowKey={(u) => u.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('users:empty.title')}
        emptyDescription={t('users:empty.description')}
        onRowClick={(u) => navigate(`/admin/users/${u.id}`)}
      />

      <UserFormModal
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateError(null); }}
        mode="create"
        isSubmitting={createMutation.isPending}
        submitError={createError}
        onSubmitCreate={(values: CreateUserFormValues) => {
          setCreateError(null);
          createMutation.mutate(values, {
            onSuccess: (user) => { setCreateOpen(false); navigate(`/admin/users/${user.id}`); },
            onError: (err) => setCreateError(err instanceof ApiError ? err.message : t('common:error.generic')),
          });
        }}
      />
    </div>
  );
}
