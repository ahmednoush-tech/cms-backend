import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useRole, useAssignPermissions, useAssignRoleToUser, useRemoveRoleFromUser } from '../../../api/queries/useRoles';
import { usePermissionsList } from '../../../api/queries/useRoles';
import { useAdminUsers } from '../../../api/queries/useAdminUsers';
import { useDepartments } from '../../../api/queries/useDepartments';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { COMPANY_WIDE_SCOPE_ID } from '../../../rbac/scopeConstants';
import { ApiError } from '../../../api/client';

// Fixed display order for permission modules — matches the
// sidebar's own grouping order (Sidebar.tsx GROUP_ORDER) so a
// person already familiar with the navigation finds permissions
// grouped the same way. "Common" (cross-cutting permissions with
// no single owning module) sorts last since it isn't a section a
// person would look for first. Any module value the backend
// returns that isn't listed here still renders — it's just sorted
// after these, in whatever order the API returned it.
const MODULE_ORDER = ['CRM', 'Operations', 'Finance', 'Fleet', 'HR', 'Payroll', 'Analytics', 'Administration', 'Common'];

/**
 * Permission assignment here is ADD-ONLY, matching the backend
 * exactly (confirmed this session — POST /roles/:id/permissions
 * upserts each submitted ID, and there is no endpoint to remove a
 * permission from a role). The checklist below only ever shows
 * permissions NOT yet granted; there is no "unassign" checkbox or
 * button anywhere on this page, because clicking one would call
 * an endpoint that doesn't exist.
 */
export function RoleDetailPage() {
  const { t } = useTranslation(['roles', 'common']);
  const { id } = useParams<{ id: string }>();
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [assignError, setAssignError] = useState<string | null>(null);
  const [userIdInput, setUserIdInput] = useState('');
  const [assignScopeId, setAssignScopeId] = useState('');
  const [userRoleError, setUserRoleError] = useState<string | null>(null);
  const [confirmRemoveUser, setConfirmRemoveUser] = useState<{ userId: string; scopeId: string } | null>(null);

  const { data: role, isLoading, error } = useRole(id);
  const { data: usersData } = useAdminUsers({ page: 1, pageSize: 500 });
  const { data: departmentsData } = useDepartments({ page: 1, pageSize: 500 });
  const { data: allPermissions } = usePermissionsList();
  const assignMutation = useAssignPermissions(id!);
  const assignUserMutation = useAssignRoleToUser();
  const removeUserMutation = useRemoveRoleFromUser();

  const grantedIds = useMemo(() => new Set(role?.rolePermissions.map((rp) => rp.permissionId) ?? []), [role]);
  const assignedUserIds = new Set((role?.userRoles ?? []).map((ur) => ur.userId));
  const assignableUsers = (usersData?.items ?? []).filter((u) => !assignedUserIds.has(u.id));
  const notYetGranted = useMemo(
    () => (allPermissions ?? []).filter((p) => !grantedIds.has(p.id)),
    [allPermissions, grantedIds],
  );

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!role) return null;

  const groupedGranted = groupByModule(role.rolePermissions.map((rp) => rp.permission));
  const groupedAvailable = groupByModule(notYetGranted);

  return (
    <div>
      <PageHeader title={role.name} breadcrumb={t('roles:title')} />
      {role.description && <p className="mb-4 text-sm text-ink-muted">{role.description}</p>}

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('roles:detail.grantedPermissions')}</p>
        {role.rolePermissions.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('roles:detail.noPermissions')}</p>
        ) : (
          groupedGranted.map(([module, perms]) => (
            <div key={module} className="mb-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t(`roles:module.${module}`, { defaultValue: module })}</p>
              <div className="flex flex-wrap gap-1.5">
                {perms.map((p) => (
                  <span key={p.id} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {p.resource}:{p.action}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <PermissionGate requires={PERMISSIONS.Administration.roles.manage}>
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('roles:detail.addPermissions')}</p>
          {notYetGranted.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('roles:detail.allGranted')}</p>
          ) : (
            <>
              {groupedAvailable.map(([module, perms]) => (
                <div key={module} className="mb-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t(`roles:module.${module}`, { defaultValue: module })}</p>
                  <div className="flex flex-wrap gap-3">
                    {perms.map((p) => (
                      <label key={p.id} className="flex items-center gap-1.5 text-xs text-ink">
                        <input
                          type="checkbox"
                          checked={selectedToAdd.has(p.id)}
                          onChange={(e) => {
                            const next = new Set(selectedToAdd);
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                            setSelectedToAdd(next);
                          }}
                        />
                        {p.resource}:{p.action}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button
                type="button"
                disabled={selectedToAdd.size === 0 || assignMutation.isPending}
                onClick={() => {
                  setAssignError(null);
                  assignMutation.mutate(
                    { permissionIds: Array.from(selectedToAdd) },
                    {
                      onSuccess: () => setSelectedToAdd(new Set()),
                      onError: (err) => setAssignError(err instanceof ApiError ? err.message : t('common:error.generic')),
                    },
                  );
                }}
                className="mt-2 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
              >
                {t('roles:detail.grantSelected', { count: selectedToAdd.size })}
              </button>
              {assignError && <p className="mt-2 text-sm text-danger" role="alert">{assignError}</p>}
            </>
          )}
        </div>
      </PermissionGate>

      <PermissionGate requires={PERMISSIONS.Administration.roles.manage}>
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-medium text-ink">{t('roles:detail.assignedUsers')}</p>
          {(role.userRoles ?? []).length === 0 ? (
            <p className="mb-3 text-sm text-ink-muted">{t('roles:detail.noAssignedUsers')}</p>
          ) : (
            <ul className="mb-3 flex flex-wrap gap-2">
              {role.userRoles!.map((ur) => (
                <li key={`${ur.userId}-${ur.scopeId}`} className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                  {ur.user.name} ({ur.user.email})
                  {ur.scopeId !== COMPANY_WIDE_SCOPE_ID && (
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium">
                      {t('roles:detail.scopedToDepartment', { name: departmentsData?.items.find((d) => d.id === ur.scopeId)?.name ?? ur.scopeId })}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={t('roles:detail.removeUserAria', { name: ur.user.name })}
                    onClick={() => setConfirmRemoveUser({ userId: ur.userId, scopeId: ur.scopeId })}
                    className="text-primary hover:text-danger"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mb-2 text-sm font-medium text-ink">{t('roles:detail.assignToUser')}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setUserRoleError(null);
              assignUserMutation.mutate(
                {
                  userId: userIdInput,
                  roleId: id!,
                  scopeType: assignScopeId ? 'department' : undefined,
                  scopeId: assignScopeId || undefined,
                },
                {
                  onSuccess: () => { setUserIdInput(''); setAssignScopeId(''); },
                  onError: (err) => setUserRoleError(err instanceof ApiError ? err.message : t('common:error.generic')),
                },
              );
            }}
            className="flex flex-wrap gap-2"
          >
            <select
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink"
            >
              <option value="">{t('roles:detail.selectUserPlaceholder')}</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
            <select
              value={assignScopeId}
              onChange={(e) => setAssignScopeId(e.target.value)}
              className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink"
              title={t('roles:detail.scopeHint')}
            >
              <option value="">{t('roles:detail.wholeCompany')}</option>
              {(departmentsData?.items ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button type="submit" disabled={assignUserMutation.isPending || !userIdInput} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('roles:detail.assign')}
            </button>
          </form>
          <p className="mt-1 text-xs text-ink-muted">{t('roles:detail.scopeHint')}</p>
          {userRoleError && <p className="mt-2 text-sm text-danger" role="alert">{userRoleError}</p>}
        </div>
      </PermissionGate>

      <ConfirmDialog
        open={!!confirmRemoveUser}
        onOpenChange={(open) => !open && setConfirmRemoveUser(null)}
        title={t('roles:detail.removeUserTitle')}
        message={t('roles:detail.removeUserMessage')}
        variant="destructive"
        isLoading={removeUserMutation.isPending}
        onConfirm={() =>
          confirmRemoveUser &&
          removeUserMutation.mutate(
            { userId: confirmRemoveUser.userId, roleId: id!, scopeId: confirmRemoveUser.scopeId === COMPANY_WIDE_SCOPE_ID ? undefined : confirmRemoveUser.scopeId },
            { onSuccess: () => setConfirmRemoveUser(null) },
          )
        }
      />
    </div>
  );
}

function groupByModule<T extends { module: string; resource: string }>(items: T[]): Array<[string, T[]]> {
  const grouped = items.reduce<Record<string, T[]>>((acc, item) => {
    (acc[item.module] ??= []).push(item);
    return acc;
  }, {});
  // Sort permissions within each module by resource, so related
  // permissions (all "customers" actions, all "leads" actions)
  // stay adjacent rather than appearing in whatever order the API
  // returned them.
  Object.values(grouped).forEach((perms) => perms.sort((a, b) => a.resource.localeCompare(b.resource)));
  // Sort the modules themselves by the fixed, sidebar-matching
  // order — any module not in that list (a value the backend
  // added later) still appears, just after the known ones.
  return Object.entries(grouped).sort(([a], [b]) => {
    const ia = MODULE_ORDER.indexOf(a);
    const ib = MODULE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
