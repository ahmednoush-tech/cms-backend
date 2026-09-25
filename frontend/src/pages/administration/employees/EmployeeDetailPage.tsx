import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useEmployee, useUpdateEmployee, useLinkEmployeeUser } from '../../../api/queries/useEmployees';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { AttachmentsSection } from '../../../components/AttachmentsSection/AttachmentsSection';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { EmployeeFormModal, type EmployeeFormValues } from './EmployeeFormModal';
import { AuditHistoryLink } from '../../../components/AuditHistoryLink/AuditHistoryLink';

export function EmployeeDetailPage() {
  const { t } = useTranslation(['employees', 'common']);
  const { id } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [linkUserId, setLinkUserId] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const { data: employee, isLoading, error } = useEmployee(id);
  const updateMutation = useUpdateEmployee(id!);
  const linkMutation = useLinkEmployeeUser(id!);

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!employee) return null;

  return (
    <div>
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        breadcrumb={t('employees:title')}
        action={
          <div className="flex gap-2">
            <AuditHistoryLink entityType="employee" entityId={employee.id} />
            <PermissionGate requires={PERMISSIONS.Administration.employees.edit}>
              <button type="button" onClick={() => { setEditError(null); setEditOpen(true); }} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
                {t('common:action.edit')}
              </button>
            </PermissionGate>
          </div>
        }
      />

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <Field label={t('employees:fields.employeeNumber')} value={employee.employeeNumber} />
        <Field label={t('employees:fields.status')} value={t(`employees:status.${employee.status}`)} />
        <Field label={t('employees:fields.jobTitle')} value={employee.jobTitle ?? '—'} />
        <Field label={t('employees:fields.email')} value={employee.email ?? '—'} />
        <Field label={t('employees:fields.phone')} value={employee.phone ?? '—'} />
        <Field label={t('employees:fields.hireDate')} value={employee.hireDate?.slice(0, 10) ?? '—'} />
        {/* department/manager are only present because findOne includes them (confirmed this session) — never assume they're on the list rows. */}
        <Field label={t('employees:fields.department')} value={employee.department?.name ?? t('employees:detail.noDepartment')} />
        <Field label={t('employees:fields.manager')} value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : t('employees:detail.noManager')} />
        <Field label={t('employees:fields.linkedUser')} value={employee.user?.email ?? t('employees:detail.noLinkedUser')} />
      </dl>

      {/* One-directional, additive link only (confirmed — no unlink endpoint exists) — hidden entirely once already linked. */}
      {!employee.user && (
        <PermissionGate requires={PERMISSIONS.Administration.employees.edit}>
          <div className="mt-6 rounded-lg border border-border bg-surface p-4">
            <p className="mb-2 text-sm font-medium text-ink">{t('employees:detail.linkUser')}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setLinkError(null);
                linkMutation.mutate(linkUserId, {
                  onSuccess: () => setLinkUserId(''),
                  onError: (err) => setLinkError(err instanceof ApiError ? err.message : t('common:error.generic')),
                });
              }}
              className="flex gap-2"
            >
              <input
                value={linkUserId}
                onChange={(e) => setLinkUserId(e.target.value)}
                placeholder={t('employees:detail.userIdPlaceholder')}
                className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink"
              />
              <button type="submit" disabled={linkMutation.isPending || !linkUserId} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
                {t('employees:detail.link')}
              </button>
            </form>
            {linkError && <p className="mt-2 text-sm text-danger" role="alert">{linkError}</p>}
          </div>
        </PermissionGate>
      )}

      <div className="mt-4">
        <AttachmentsSection entityType="employee" entityId={employee.id} />
      </div>

      <EmployeeFormModal
        open={editOpen}
        onOpenChange={(open) => { setEditOpen(open); if (!open) setEditError(null); }}
        mode="edit"
        initialValues={employee}
        isSubmitting={updateMutation.isPending}
        submitError={editError}
        onSubmit={(values: EmployeeFormValues) => {
          setEditError(null);
          updateMutation.mutate(
            {
              ...values,
              departmentId: values.departmentId || undefined,
              email: values.email || undefined,
              managerId: values.managerId || undefined,
              basicSalary: values.basicSalary ? Number(values.basicSalary) : undefined,
              housingAllowance: values.housingAllowance ? Number(values.housingAllowance) : undefined,
              otherAllowances: values.otherAllowances ? Number(values.otherAllowances) : undefined,
              gosiEmployeeRate: values.gosiEmployeeRate ? Number(values.gosiEmployeeRate) : undefined,
              gosiEmployerRate: values.gosiEmployerRate ? Number(values.gosiEmployerRate) : undefined,
              nationality: values.nationality || undefined,
              iqamaNumber: values.iqamaNumber || undefined,
              iqamaExpiryDate: values.iqamaExpiryDate || undefined,
            },
            {
              onSuccess: () => setEditOpen(false),
              onError: (err) => setEditError(err instanceof ApiError ? err.message : t('common:error.generic')),
            },
          );
        }}
      />
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
