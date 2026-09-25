import { useTranslation } from 'react-i18next';

interface ErrorStateProps {
  variant?: 'generic' | 'not-found' | 'forbidden' | 'network';
  message?: string;
  onRetry?: () => void;
}

/**
 * A failed widget/list should degrade in place — this is NOT the
 * same as the full /403 or /401 redirect pages (those are for a
 * page's PRIMARY query failing; this is for anything secondary,
 * e.g. one Dashboard card failing to load shouldn't take down the
 * whole page). Design doc section F/J.
 */
export function ErrorState({ variant = 'generic', message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation('common');

  const titleKey =
    variant === 'not-found'
      ? 'error.notFound'
      : variant === 'forbidden'
        ? 'error.forbidden'
        : variant === 'network'
          ? 'error.network'
          : 'error.generic';

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-danger/30 bg-danger/5 px-6 py-10 text-center">
      <p className="text-sm font-medium text-danger">{t(titleKey)}</p>
      {message && <p className="max-w-md text-xs text-ink-muted">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded border border-border px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
        >
          {t('action.retry')}
        </button>
      )}
    </div>
  );
}
