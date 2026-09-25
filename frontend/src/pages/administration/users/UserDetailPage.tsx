import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdminUser, useUpdateAdminUser, useSetUserPassword, useDeleteAdminUser, useGrantPermission, useRevokePermission } from '../../../api/queries/useAdminUsers';
import { useRoles, useAssignRoleToUser, useRemoveRoleFromUser, usePermissionsList } from '../../../api/queries/useRoles';
import { useDepartments } from '../../../api/queries/useDepartments';
import { useAuth } from '../../../auth/useAuth';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { COMPANY_WIDE_SCOPE_ID } from '../../../rbac/scopeConstants';
import { PASSWORD_MIN_LENGTH, isStrongPassword } from '../../../lib/passwordPolicy';
import { ApiError } from '../../../api/client';
import { UserFormModal, type EditUserFormValues } from './UserFormModal';
import type { AdminUser } from '../../../types/entities/administration';

export function UserDetailPage() {
  const { t } = useTranslation(['users', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: user, isLoading, error } = useAdminUser(id);
  const updateMutation = useUpdateAdminUser(id!);
  const deleteMutation = useDeleteAdminUser();

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!user) return null;

  // Hidden rather than shown-disabled — the backend blocks this
  // outright (a real gap found and fixed this session: nothing
  // previously stopped a user from deleting their own account
  // mid-session), and a disabled button with no visible reason
  // would just be confusing here since there's nothing else on
  // this page to explain it.
  const isSelf = currentUser?.sub === user.id;

  return (
    <div>
      <PageHeader
        title={user.name}
        breadcrumb={t('users:title')}
        action={
          <div className="flex gap-2">
            <PermissionGate requires={PERMISSIONS.Administration.users.edit}>
              <button type="button" onClick={() => { setEditError(null); setEditOpen(true); }} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
                {t('common:action.edit')}
              </button>
            </PermissionGate>
            {!isSelf && (
              <PermissionGate requires={PERMISSIONS.Administration.users.delete}>
                <button type="button" onClick={() => { setDeleteError(null); setConfirmDeleteOpen(true); }} className="rounded border border-danger px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10">
                  {t('common:action.delete')}
                </button>
              </PermissionGate>
            )}
          </div>
        }
      />

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <Field label={t('users:fields.email')} value={user.email} />
        <Field label={t('users:fields.status')} value={t(`users:status.${user.status}`)} />
        <Field label={t('users:fields.phone')} value={user.phone ?? '—'} />
        <Field label={t('users:fields.lastLogin')} value={user.lastLoginAt?.slice(0, 10) ?? t('users:columns.never')} />
      </dl>

      <UserFormModal
        open={editOpen}
        onOpenChange={(open) => { setEditOpen(open); if (!open) setEditError(null); }}
        mode="edit"
        initialValues={user}
        isSubmitting={updateMutation.isPending}
        submitError={editError}
        onSubmitEdit={(values: EditUserFormValues) => {
          setEditError(null);
          updateMutation.mutate(values, {
            onSuccess: () => setEditOpen(false),
            onError: (err) => setEditError(err instanceof ApiError ? err.message : t('common:error.generic')),
          });
        }}
      />

      <RolesSection user={user} />
      <PermissionsSection user={user} />
      <SetPasswordSection userId={user.id} />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => { setConfirmDeleteOpen(open); if (!open) setDeleteError(null); }}
        title={t('users:detail.deleteTitle')}
        message={t('users:detail.deleteMessage', { name: user.name })}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(user.id, {
            onSuccess: () => navigate('/admin/users'),
            onError: (err) => setDeleteError(err instanceof ApiError ? err.message : t('common:error.generic')),
          })
        }
      />
      {deleteError && <p className="mt-2 text-sm text-danger" role="alert">{deleteError}</p>}
    </div>
  );
}

/**
 * Shows this user's currently-assigned roles (each removable) and
 * a form to assign one more — the mirror image of RoleDetailPage's
 * own "assign this role to a user" section, so the workflow works
 * starting from either side. userRoles is only present because
 * findOne includes it (confirmed this session) — never assume
 * it's on the list rows.
 */
function RolesSection({ user }: { user: AdminUser }) {
  const { t } = useTranslation(['users', 'roles', 'common']);
  const { data: allRoles } = useRoles();
  const { data: departmentsData } = useDepartments({ page: 1, pageSize: 500 });
  const assignMutation = useAssignRoleToUser();
  const removeMutation = useRemoveRoleFromUser();
  const [roleIdToAssign, setRoleIdToAssign] = useState('');
  const [assignScopeId, setAssignScopeId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const assignedRoleIds = new Set((user.userRoles ?? []).map((ur) => ur.roleId));
  const assignableRoles = (allRoles ?? []).filter((r) => !assignedRoleIds.has(r.id));

  return (
    <PermissionGate requires={PERMISSIONS.Administration.users.edit}>
      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium text-ink">{t('users:detail.currentRoles')}</p>
        {(user.userRoles ?? []).length === 0 ? (
          <p className="mb-3 text-sm text-ink-muted">{t('users:detail.noRoles')}</p>
        ) : (
          <ul className="mb-3 flex flex-wrap gap-2">
            {user.userRoles!.map((ur) => (
              <li key={`${ur.roleId}-${ur.scopeId}`} className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                {ur.role.name}
                {ur.scopeId !== COMPANY_WIDE_SCOPE_ID && (
                  <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium">
                    {t('roles:detail.scopedToDepartment', { name: departmentsData?.items.find((d) => d.id === ur.scopeId)?.name ?? ur.scopeId })}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={t('users:detail.removeRole', { name: ur.role.name })}
                  onClick={() => {
                    setRemoveError(null);
                    removeMutation.mutate(
                      { userId: user.id, roleId: ur.roleId, scopeId: ur.scopeId === COMPANY_WIDE_SCOPE_ID ? undefined : ur.scopeId },
                      { onError: (err) => setRemoveError(err instanceof ApiError ? err.message : t('common:error.generic')) },
                    );
                  }}
                  className="text-primary hover:text-danger"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {removeError && <p className="mb-3 text-sm text-danger" role="alert">{removeError}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAssignError(null);
            assignMutation.mutate(
              {
                userId: user.id,
                roleId: roleIdToAssign,
                scopeType: assignScopeId ? 'department' : undefined,
                scopeId: assignScopeId || undefined,
              },
              {
                onSuccess: () => { setRoleIdToAssign(''); setAssignScopeId(''); },
                onError: (err) => setAssignError(err instanceof ApiError ? err.message : t('common:error.generic')),
              },
            );
          }}
          className="flex flex-wrap gap-2"
        >
          <select
            value={roleIdToAssign}
            onChange={(e) => setRoleIdToAssign(e.target.value)}
            className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink"
          >
            <option value="">{t('users:detail.selectRolePlaceholder')}</option>
            {assignableRoles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
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
          <button type="submit" disabled={assignMutation.isPending || !roleIdToAssign} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
            {t('users:detail.assignRole')}
          </button>
        </form>
        {assignError && <p className="mt-2 text-sm text-danger" role="alert">{assignError}</p>}
      </div>
    </PermissionGate>
  );
}

/**
 * Direct per-user permission grants ("permission sets") — an
 * exception that needs neither creating nor editing a role. Kept
 * as its own section, separate from RolesSection above, since it
 * is gated by a DIFFERENT, deliberately narrower permission
 * (Administration:user_permissions:manage — see migration 109's
 * comment on why granting any single permission directly is a
 * meaningfully bigger capability than assigning a pre-defined role).
 */
function PermissionsSection({ user }: { user: AdminUser }) {
  const { t } = useTranslation(['users', 'common']);
  const { data: allPermissions } = usePermissionsList();
  const { data: departmentsData } = useDepartments({ page: 1, pageSize: 500 });
  const grantMutation = useGrantPermission(user.id);
  const revokeMutation = useRevokePermission(user.id);
  const [permissionIdToGrant, setPermissionIdToGrant] = useState('');
  const [grantScopeId, setGrantScopeId] = useState('');
  const [grantError, setGrantError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const grantedPermissionIds = new Set((user.userPermissions ?? []).map((up) => up.permissionId));
  const grantablePermissions = (allPermissions ?? []).filter((p) => !grantedPermissionIds.has(p.id));

  return (
    <PermissionGate requires={PERMISSIONS.Administration.userPermissions.manage}>
      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium text-ink">{t('users:detail.directPermissions')}</p>
        <p className="mb-2 text-xs text-ink-muted">{t('users:detail.directPermissionsHint')}</p>
        {(user.userPermissions ?? []).length === 0 ? (
          <p className="mb-3 text-sm text-ink-muted">{t('users:detail.noDirectPermissions')}</p>
        ) : (
          <ul className="mb-3 flex flex-wrap gap-2">
            {user.userPermissions!.map((up) => (
              <li key={`${up.permissionId}-${up.scopeId}`} className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                {up.permission.module}:{up.permission.resource}:{up.permission.action}
                {up.scopeId !== COMPANY_WIDE_SCOPE_ID && (
                  <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium">
                    {t('roles:detail.scopedToDepartment', { name: departmentsData?.items.find((d) => d.id === up.scopeId)?.name ?? up.scopeId })}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={t('users:detail.revokePermission', { name: `${up.permission.module}:${up.permission.resource}:${up.permission.action}` })}
                  onClick={() => {
                    setRevokeError(null);
                    revokeMutation.mutate(
                      { permissionId: up.permissionId, scopeId: up.scopeId === COMPANY_WIDE_SCOPE_ID ? undefined : up.scopeId },
                      { onError: (err) => setRevokeError(err instanceof ApiError ? err.message : t('common:error.generic')) },
                    );
                  }}
                  className="text-primary hover:text-danger"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {revokeError && <p className="mb-3 text-sm text-danger" role="alert">{revokeError}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setGrantError(null);
            grantMutation.mutate(
              {
                permissionId: permissionIdToGrant,
                scopeType: grantScopeId ? 'department' : undefined,
                scopeId: grantScopeId || undefined,
              },
              {
                onSuccess: () => { setPermissionIdToGrant(''); setGrantScopeId(''); },
                onError: (err) => setGrantError(err instanceof ApiError ? err.message : t('common:error.generic')),
              },
            );
          }}
          className="flex flex-wrap gap-2"
        >
          <select
            value={permissionIdToGrant}
            onChange={(e) => setPermissionIdToGrant(e.target.value)}
            className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink"
          >
            <option value="">{t('users:detail.selectPermissionPlaceholder')}</option>
            {grantablePermissions.map((p) => (
              <option key={p.id} value={p.id}>{p.module}:{p.resource}:{p.action}</option>
            ))}
          </select>
          <select
            value={grantScopeId}
            onChange={(e) => setGrantScopeId(e.target.value)}
            className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink"
          >
            <option value="">{t('roles:detail.wholeCompany')}</option>
            {(departmentsData?.items ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button type="submit" disabled={grantMutation.isPending || !permissionIdToGrant} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
            {t('users:detail.grantPermission')}
          </button>
        </form>
        {grantError && <p className="mt-2 text-sm text-danger" role="alert">{grantError}</p>}
      </div>
    </PermissionGate>
  );
}

/**
 * The admin-set-password path (distinct from the self-service
 * "forgot password" email flow) — a dedicated section, not folded
 * into the edit form, matching the backend's own separation
 * (PATCH /users/:id/password is a different endpoint from PATCH
 * /users/:id, and UpdateUserDto still has no password field).
 */
function SetPasswordSection({ userId }: { userId: string }) {
  const { t } = useTranslation(['users', 'common']);
  const setPasswordMutation = useSetUserPassword(userId);
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  return (
    <PermissionGate requires={PERMISSIONS.Administration.users.edit}>
      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium text-ink">{t('users:detail.setPassword')}</p>
        <p className="mb-3 text-xs text-ink-muted">{t('users:detail.setPasswordHint')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            setSuccess(false);
            if (newPassword.length < PASSWORD_MIN_LENGTH) {
              setFormError(t('common:validation.minLength'));
              return;
            }
            if (!isStrongPassword(newPassword)) {
              setFormError(t('common:validation.passwordStrength'));
              return;
            }
            setPasswordMutation.mutate(newPassword, {
              onSuccess: () => {
                setNewPassword('');
                setSuccess(true);
              },
              onError: (err) => setFormError(err instanceof ApiError ? err.message : t('common:error.generic')),
            });
          }}
          className="flex gap-2"
        >
          <input
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setSuccess(false); }}
            placeholder={t('users:detail.newPasswordPlaceholder')}
            autoComplete="new-password"
            className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink"
          />
          <button
            type="submit"
            disabled={setPasswordMutation.isPending || !newPassword}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            {setPasswordMutation.isPending ? t('common:action.processing') : t('users:detail.setPasswordAction')}
          </button>
        </form>
        {formError && (
          <p className="mt-2 text-sm text-danger" role="alert">
            {formError}
          </p>
        )}
        {success && <p className="mt-2 text-sm text-success">{t('users:detail.setPasswordSuccess')}</p>}
      </div>
    </PermissionGate>
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
