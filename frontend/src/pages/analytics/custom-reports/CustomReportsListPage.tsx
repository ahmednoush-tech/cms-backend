import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useReportDefinitions, useDeleteReportDefinition } from '../../../api/queries/useCustomReports';
import { reportDefinitionsApi } from '../../../api/endpoints/reports';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function CustomReportsListPage() {
  const { t } = useTranslation(['reports', 'common']);
  const navigate = useNavigate();
  const { data: reports, isLoading, error } = useReportDefinitions();
  const deleteMutation = useDeleteReportDefinition();
  // Tracks which row's export is in flight, so only that row's
  // button shows a busy state and can't be double-clicked.
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (id: string, name: string) => {
    setExportError(null);
    setExportingId(id);
    try {
      await reportDefinitionsApi.exportCsv(id, name);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : t('reports:export.error'));
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('reports:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Analytics.customReports.manage}>
            <button type="button" onClick={() => navigate('/analytics/custom-reports/new')} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('reports:action.new')}
            </button>
          </PermissionGate>
        }
      />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">{t('reports:description')}</p>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}
      {exportError && <p className="mb-3 text-sm text-danger" role="alert">{exportError}</p>}

      {reports && reports.length === 0 && <EmptyState title={t('reports:empty')} />}

      {reports && reports.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('reports:fields.name')}</th>
                <th className="p-3 text-start">{t('reports:fields.entityType')}</th>
                <th className="p-3 text-start">{t('reports:fields.chartType')}</th>
                {/* Always rendered: exporting only needs view access
                    (same as the backend endpoint), which anyone on
                    this page already has. Only Delete is gated. */}
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((report) => (
                <tr key={report.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => navigate(`/analytics/custom-reports/${report.id}`)}>
                  <td className="p-3 font-medium text-ink">{report.name}</td>
                  <td className="p-3 text-ink-muted">{report.entityType}</td>
                  <td className="p-3 text-ink-muted">{t(`reports:chartType.${report.chartType}`)}</td>
                  <td className="p-3 text-end" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => handleExport(report.id, report.name)}
                        disabled={exportingId === report.id}
                        className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                      >
                        {exportingId === report.id ? t('reports:export.inProgress') : t('reports:export.csv')}
                      </button>
                      <PermissionGate requires={PERMISSIONS.Analytics.customReports.manage}>
                        <button type="button" onClick={() => deleteMutation.mutate(report.id)} className="text-sm font-medium text-danger hover:underline">
                          {t('common:action.delete')}
                        </button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
