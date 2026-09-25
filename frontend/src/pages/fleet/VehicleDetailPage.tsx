import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useVehicle, useAssignVehicle, useReturnVehicle, useAddMaintenanceRecord } from '../../api/queries/useVehicles';
import { useEmployees } from '../../api/queries/useEmployees';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../components/dashboard/FinancialValue';
import { PermissionGate } from '../../rbac/PermissionGate';
import { PERMISSIONS } from '../../rbac/permissionConstants';
import { ApiError } from '../../api/client';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-success/15 text-success',
  maintenance: 'bg-warning/15 text-warning',
  retired: 'bg-danger/15 text-danger',
};

export function VehicleDetailPage() {
  const { t } = useTranslation(['fleet', 'common']);
  const { id } = useParams<{ id: string }>();
  const { data: vehicle, isLoading, error } = useVehicle(id);
  const { data: employeesData } = useEmployees({ page: 1, pageSize: 200 });

  const assignMutation = useAssignVehicle(id ?? '');
  const returnMutation = useReturnVehicle(id ?? '');
  const maintenanceMutation = useAddMaintenanceRecord(id ?? '');

  const [assignForm, setAssignForm] = useState({ employeeId: '', assignedDate: new Date().toISOString().slice(0, 10), notes: '' });
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [maintenanceForm, setMaintenanceForm] = useState({ serviceDate: new Date().toISOString().slice(0, 10), serviceType: '', description: '', cost: '', odometerAtService: '', performedBy: '' });
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!vehicle) return null;

  const activeAssignment = vehicle.assignments?.find((a) => !a.returnedDate);
  const handleError = (err: unknown) => setActionError(err instanceof ApiError ? err.message : t('common:error.generic'));

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    assignMutation.mutate(
      { employeeId: assignForm.employeeId, assignedDate: assignForm.assignedDate, notes: assignForm.notes || undefined },
      { onError: handleError },
    );
  };

  const handleReturn = () => {
    setActionError(null);
    returnMutation.mutate({ returnedDate: returnDate }, { onError: handleError });
  };

  const handleAddMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    maintenanceMutation.mutate(
      {
        serviceDate: maintenanceForm.serviceDate,
        serviceType: maintenanceForm.serviceType,
        description: maintenanceForm.description || undefined,
        cost: maintenanceForm.cost ? Number(maintenanceForm.cost) : undefined,
        odometerAtService: Number(maintenanceForm.odometerAtService),
        performedBy: maintenanceForm.performedBy || undefined,
      },
      {
        onSuccess: () => setMaintenanceForm({ serviceDate: new Date().toISOString().slice(0, 10), serviceType: '', description: '', cost: '', odometerAtService: '', performedBy: '' }),
        onError: handleError,
      },
    );
  };

  return (
    <div>
      <PageHeader
        title={vehicle.plateNumber}
        breadcrumb={t('fleet:title')}
        action={<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[vehicle.status]}`}>{t(`fleet:status.${vehicle.status}`)}</span>}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-4 text-sm md:grid-cols-4">
        <div><p className="text-xs text-ink-muted">{t('fleet:fields.make')}/{t('fleet:fields.model')}</p><p className="font-medium text-ink">{vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}</p></div>
        <div><p className="text-xs text-ink-muted">{t('fleet:fields.odometerReading')}</p><p className="font-medium text-ink">{vehicle.odometerReading.toLocaleString()}</p></div>
        <div><p className="text-xs text-ink-muted">{t('fleet:fields.registrationExpiryDate')}</p><p className="font-medium text-ink">{vehicle.registrationExpiryDate?.slice(0, 10) ?? '—'}</p></div>
        <div><p className="text-xs text-ink-muted">{t('fleet:fields.insuranceExpiryDate')}</p><p className="font-medium text-ink">{vehicle.insuranceExpiryDate?.slice(0, 10) ?? '—'}</p></div>
      </div>

      {actionError && <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{actionError}</p>}

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('fleet:detail.assignment')}</p>
        {activeAssignment ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink">{t('fleet:detail.currentlyAssignedTo')}: <span className="font-medium">{activeAssignment.employee?.firstName} {activeAssignment.employee?.lastName}</span></p>
              <p className="text-xs text-ink-muted">{t('fleet:fields.assignedDate')}: {activeAssignment.assignedDate.slice(0, 10)}</p>
            </div>
            <PermissionGate requires={PERMISSIONS.Fleet.vehicles.assign}>
              <div className="flex items-center gap-2">
                <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
                <button type="button" onClick={handleReturn} disabled={returnMutation.isPending} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50">
                  {returnMutation.isPending ? t('common:action.processing') : t('fleet:actions.returnVehicle')}
                </button>
              </div>
            </PermissionGate>
          </div>
        ) : (
          <PermissionGate requires={PERMISSIONS.Fleet.vehicles.assign} fallback={<p className="text-sm text-ink-muted">{t('fleet:unassigned')}</p>}>
            {vehicle.status !== 'active' ? (
              <p className="text-sm text-ink-muted">{t('fleet:detail.cannotAssignNotActive')}</p>
            ) : (
              <form onSubmit={handleAssign} className="flex flex-wrap items-end gap-2">
                <select value={assignForm.employeeId} onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })} required className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                  <option value="">{t('fleet:fields.employee')}</option>
                  {(employeesData?.items ?? []).map((emp) => (<option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>))}
                </select>
                <input type="date" value={assignForm.assignedDate} onChange={(e) => setAssignForm({ ...assignForm, assignedDate: e.target.value })} required className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
                <button type="submit" disabled={assignMutation.isPending} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
                  {assignMutation.isPending ? t('common:action.processing') : t('fleet:actions.assign')}
                </button>
              </form>
            )}
          </PermissionGate>
        )}
      </div>

      {(vehicle.assignments ?? []).length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('fleet:detail.assignmentHistory')}</p>
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr><th className="pb-2 text-start">{t('fleet:fields.employee')}</th><th className="pb-2 text-start">{t('fleet:fields.assignedDate')}</th><th className="pb-2 text-start">{t('fleet:fields.returnedDate')}</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vehicle.assignments!.map((a) => (
                <tr key={a.id}>
                  <td className="py-2">{a.employee?.firstName} {a.employee?.lastName}</td>
                  <td className="py-2">{a.assignedDate.slice(0, 10)}</td>
                  <td className="py-2">{a.returnedDate?.slice(0, 10) ?? t('fleet:detail.stillAssigned')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('fleet:detail.maintenanceHistory')}</p>
        {(vehicle.maintenanceRecords ?? []).length > 0 && (
          <table className="mb-4 w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('fleet:fields.serviceDate')}</th>
                <th className="pb-2 text-start">{t('fleet:fields.serviceType')}</th>
                <th className="pb-2 text-start">{t('fleet:fields.cost')}</th>
                <th className="pb-2 text-start">{t('fleet:fields.odometerAtService')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vehicle.maintenanceRecords!.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">{r.serviceDate.slice(0, 10)}</td>
                  <td className="py-2">{r.serviceType}</td>
                  <td className="py-2"><FinancialValue value={r.cost} /></td>
                  <td className="py-2">{r.odometerAtService.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <PermissionGate requires={PERMISSIONS.Fleet.maintenance.create}>
          <form onSubmit={handleAddMaintenance} className="grid grid-cols-2 gap-3 border-t border-border pt-4 md:grid-cols-3">
            <input type="date" value={maintenanceForm.serviceDate} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, serviceDate: e.target.value })} required className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
            <input placeholder={t('fleet:fields.serviceType')} value={maintenanceForm.serviceType} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, serviceType: e.target.value })} required className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
            <input type="number" min="0" placeholder={t('fleet:fields.odometerAtService')} value={maintenanceForm.odometerAtService} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, odometerAtService: e.target.value })} required className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
            <input type="number" min="0" step="0.01" placeholder={t('fleet:fields.cost')} value={maintenanceForm.cost} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })} className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
            <input placeholder={t('fleet:fields.performedBy')} value={maintenanceForm.performedBy} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, performedBy: e.target.value })} className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
            <button type="submit" disabled={maintenanceMutation.isPending} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
              {maintenanceMutation.isPending ? t('common:action.processing') : t('fleet:actions.addMaintenanceRecord')}
            </button>
          </form>
        </PermissionGate>
      </div>
    </div>
  );
}
