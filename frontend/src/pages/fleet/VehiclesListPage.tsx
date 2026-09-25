import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useVehicles } from '../../api/queries/useVehicles';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { PermissionGate } from '../../rbac/PermissionGate';
import { PERMISSIONS } from '../../rbac/permissionConstants';
import { ApiError } from '../../api/client';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-success/15 text-success',
  maintenance: 'bg-warning/15 text-warning',
  retired: 'bg-danger/15 text-danger',
};

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const daysUntil = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysUntil <= 30;
}

export function VehiclesListPage() {
  const { t } = useTranslation(['fleet', 'common']);
  const navigate = useNavigate();
  const { data: vehicles, isLoading, error } = useVehicles();

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant="generic" message={apiError?.message} />;
  }

  return (
    <div>
      <PageHeader
        title={t('fleet:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Fleet.vehicles.create}>
            <button
              type="button"
              onClick={() => navigate('/fleet/vehicles/new')}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90"
            >
              {t('fleet:actions.new')}
            </button>
          </PermissionGate>
        }
      />

      {(vehicles ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-ink">{t('fleet:empty.title')}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('fleet:empty.description')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('fleet:columns.plateNumber')}</th>
                <th className="p-3 text-start">{t('fleet:columns.vehicle')}</th>
                <th className="p-3 text-start">{t('fleet:columns.assignedTo')}</th>
                <th className="p-3 text-start">{t('fleet:columns.status')}</th>
                <th className="p-3 text-start">{t('fleet:columns.documents')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vehicles!.map((vehicle) => {
                const activeAssignment = vehicle.assignments?.[0];
                const docsExpiring = isExpiringSoon(vehicle.registrationExpiryDate) || isExpiringSoon(vehicle.insuranceExpiryDate);
                return (
                  <tr key={vehicle.id} onClick={() => navigate(`/fleet/vehicles/${vehicle.id}`)} className="cursor-pointer hover:bg-surface-muted">
                    <td className="p-3 font-medium text-ink">{vehicle.plateNumber}</td>
                    <td className="p-3">{vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}</td>
                    <td className="p-3">
                      {activeAssignment ? `${activeAssignment.employee?.firstName} ${activeAssignment.employee?.lastName}` : t('fleet:unassigned')}
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[vehicle.status]}`}>
                        {t(`fleet:status.${vehicle.status}`)}
                      </span>
                    </td>
                    <td className="p-3">
                      {docsExpiring && (
                        <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">
                          {t('fleet:documentsExpiringSoon')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
