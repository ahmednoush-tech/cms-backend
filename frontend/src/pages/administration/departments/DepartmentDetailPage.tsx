import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { useDepartment, useUpdateDepartment } from '../../../api/queries/useDepartments';
import { useEmployees } from '../../../api/queries/useEmployees';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { DepartmentFormModal, type DepartmentFormValues } from './DepartmentFormModal';

export function DepartmentDetailPage() {
  const { t } = useTranslation(['departments', 'employees', 'common']);
  const { id } = useParams<{ id: string }>();
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const { data: department, isLoading, error } = useDepartment(id);
  const updateMutation = useUpdateDepartment(id!);
  // Page size kept high rather than paginated — a single
  // department's headcount is realistically small, and this
  // mirrors how EmployeeFormModal/DepartmentFormModal already
  // fetch "all employees" for their own dropdowns elsewhere.
  const { data: employeesData, isLoading: employeesLoading } = useEmployees({ departmentId: id, page: 1, pageSize: 500 });

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!department) return null;

  return (
    <div>
      <PageHeader
        title={department.name}
        breadcrumb={t('departments:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Administration.departments.edit}>
            <button type="button" onClick={() => { setEditError(null); setEditOpen(true); }} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('common:action.edit')}
            </button>
          </PermissionGate>
        }
      />

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <Field label={t('departments:fields.status')} value={t(`departments:status.${department.status}`)} />
        <Field label={t('departments:fields.managerId')} value={department.manager ? `${department.manager.firstName} ${department.manager.lastName}` : t('departments:detail.noManager')} />
        <div className="sm:col-span-2">
          <Field label={t('departments:fields.description')} value={department.description ?? '—'} />
        </div>
      </dl>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink">{t('departments:detail.employees')}</h2>
        {employeesLoading && <LoadingState variant="card" />}
        {!employeesLoading && (employeesData?.items.length ?? 0) === 0 && (
          <p className="text-sm text-ink-muted">{t('departments:detail.noEmployees')}</p>
        )}
        {!employeesLoading && (employeesData?.items.length ?? 0) > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {employeesData!.items.map((e) => (
              <li key={e.id} className="px-4 py-2 text-sm">
                <Link to={`/admin/employees/${e.id}`} className="text-primary hover:underline">
                  {e.firstName} {e.lastName}
                </Link>
                {e.jobTitle && <span className="ms-2 text-ink-muted">— {e.jobTitle}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <DepartmentFormModal
        open={editOpen}
        onOpenChange={(open) => { setEditOpen(open); if (!open) setEditError(null); }}
        mode="edit"
        initialValues={department}
        isSubmitting={updateMutation.isPending}
        submitError={editError}
        onSubmit={(values: DepartmentFormValues) => {
          setEditError(null);
          updateMutation.mutate(
            { ...values, managerId: values.managerId || undefined },
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
