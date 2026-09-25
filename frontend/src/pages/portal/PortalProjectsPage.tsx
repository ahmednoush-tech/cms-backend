import { useTranslation } from 'react-i18next';
import { usePortalProjects } from '../../api/queries/usePortal';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { ApiError } from '../../api/client';

export function PortalProjectsPage() {
  const { t } = useTranslation(['portal', 'common']);
  const { data, isLoading, error } = usePortalProjects();

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant="generic" message={apiError?.message} />;
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-ink">{t('portal:projects.title')}</h1>

      {data && data.length === 0 && <p className="text-sm text-ink-muted">{t('portal:projects.empty')}</p>}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-medium text-ink">{p.name}</p>
                <StatusBadge entity="project" value={p.status} />
              </div>
              <p className="mb-2 text-xs text-ink-muted">{p.projectNumber}</p>
              {p.description && <p className="mb-2 text-sm text-ink-muted">{p.description}</p>}
              {(p.startDate || p.endDate) && (
                <p className="text-xs text-ink-muted">
                  {p.startDate?.slice(0, 10) ?? '—'} → {p.endDate?.slice(0, 10) ?? t('portal:projects.ongoing')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
