import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useRoles, useCreateRole } from '../../../api/queries/useRoles';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { RoleFormModal, type RoleFormValues } from './RoleFormModal';

/**
 * No <DataTable>/<Pagination> here — GET /roles takes no
 * pagination or filter params at all (confirmed this session,
 * the controller signature has none), so a paginated table would
 * imply a capability that doesn't exist. A simple list is the
 * honest representation of what the API actually returns.
 */
export function RolesListPage() {
  const { t } = useTranslation(['roles', 'common']);
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: roles, isLoading, error } = useRoles();
  const createMutation = useCreateRole();

  return (
    <div>
      <PageHeader
        title={t('roles:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Administration.roles.manage}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('roles:action.create')}
            </button>
          </PermissionGate>
        }
      />

      {isLoading && <LoadingState variant="table" />}
      {error && (
        <ErrorState variant={error instanceof ApiError && error.status === 403 ? 'forbidden' : 'generic'} message={error instanceof ApiError ? error.message : undefined} />
      )}
      {!isLoading && !error && (!roles || roles.length === 0) && (
        <EmptyState title={t('roles:empty.title')} description={t('roles:empty.description')} />
      )}
      {!isLoading && !error && roles && roles.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {roles.map((role) => (
            <li
              key={role.id}
              onClick={() => navigate(`/admin/roles/${role.id}`)}
              className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm hover:bg-surface-muted"
            >
              <div>
                <span className="font-medium text-ink">{role.name}</span>
                {role.description && <span className="ms-2 text-ink-muted">{role.description}</span>}
              </div>
              <span className="text-xs text-ink-muted">{t('roles:list.permissionCount', { count: role.rolePermissions.length })}</span>
            </li>
          ))}
        </ul>
      )}

      <RoleFormModal
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateError(null); }}
        isSubmitting={createMutation.isPending}
        submitError={createError}
        onSubmit={(values: RoleFormValues) => {
          setCreateError(null);
          createMutation.mutate(values, {
            onSuccess: (role) => { setCreateOpen(false); navigate(`/admin/roles/${role.id}`); },
            onError: (err) => setCreateError(err instanceof ApiError ? err.message : t('common:error.generic')),
          });
        }}
      />
    </div>
  );
}
