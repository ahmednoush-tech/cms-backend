import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  useEmailIntegrationStatus,
  useConnectEmailIntegration,
  useSyncEmailIntegration,
  useDisconnectEmailIntegration,
} from '../../../api/queries/useEmailIntegration';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ApiError } from '../../../api/client';

export function EmailIntegrationPage() {
  const { t } = useTranslation(['emailIntegration', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: status, isLoading } = useEmailIntegrationStatus();
  const connectMutation = useConnectEmailIntegration();
  const syncMutation = useSyncEmailIntegration();
  const disconnectMutation = useDisconnectEmailIntegration();

  const [actionError, setActionError] = useState<string | null>(null);
  const [callbackBanner, setCallbackBanner] = useState<'success' | 'failure' | null>(null);

  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected === '1') setCallbackBanner('success');
    else if (connected === '0') setCallbackBanner('failure');
    if (connected !== null) {
      searchParams.delete('connected');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = () => {
    setActionError(null);
    connectMutation.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
      onError: (err) => setActionError(err instanceof ApiError ? err.message : t('common:error.generic')),
    });
  };

  const handleDisconnect = () => {
    setActionError(null);
    disconnectMutation.mutate(undefined, { onError: (err) => setActionError(err instanceof ApiError ? err.message : t('common:error.generic')) });
  };

  const handleSync = () => {
    setActionError(null);
    syncMutation.mutate(undefined, { onError: (err) => setActionError(err instanceof ApiError ? err.message : t('common:error.generic')) });
  };

  if (isLoading) return <LoadingState variant="page" />;

  return (
    <div>
      <PageHeader title={t('emailIntegration:title')} />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">{t('emailIntegration:description')}</p>

      {callbackBanner === 'success' && (
        <p className="mb-4 rounded bg-success/10 px-3 py-2 text-sm text-success" role="status">{t('emailIntegration:callback.success')}</p>
      )}
      {callbackBanner === 'failure' && (
        <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{t('emailIntegration:callback.failure')}</p>
      )}
      {actionError && <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{actionError}</p>}

      <div className="max-w-2xl rounded-lg border border-border bg-surface p-4">
        {status?.connected ? (
          <div>
            <p className="text-sm text-ink">
              {t('emailIntegration:connectedAs')}: <span className="font-medium">{status.connectedEmail}</span>
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {t('emailIntegration:lastSynced')}: {status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : t('emailIntegration:neverSynced')}
            </p>

            {syncMutation.data && (
              <div className="mt-3 rounded bg-surface-muted p-3 text-sm">
                <p>{t('emailIntegration:syncResult.matched', { count: syncMutation.data.matchedCount })}</p>
                <p className="text-ink-muted">{t('emailIntegration:syncResult.details', { skippedNoMatch: syncMutation.data.skippedNoMatch, skippedAlreadySynced: syncMutation.data.skippedAlreadySynced })}</p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={handleSync} disabled={syncMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
                {syncMutation.isPending ? t('emailIntegration:syncing') : t('emailIntegration:syncNow')}
              </button>
              <button type="button" onClick={handleDisconnect} disabled={disconnectMutation.isPending} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50">
                {disconnectMutation.isPending ? t('common:action.processing') : t('emailIntegration:disconnect')}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-ink-muted">{t('emailIntegration:notConnected')}</p>
            <button type="button" onClick={handleConnect} disabled={connectMutation.isPending} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
              {connectMutation.isPending ? t('common:action.processing') : t('emailIntegration:connectOutlook')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
