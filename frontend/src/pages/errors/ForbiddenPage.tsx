import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  const { t } = useTranslation('auth');
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold text-ink">{t('forbidden.title')}</h1>
      <p className="max-w-md text-sm text-ink-muted">{t('forbidden.message')}</p>
      <Link to="/dashboard" className="mt-2 text-sm font-medium text-primary hover:underline">
        ← Back to Dashboard
      </Link>
    </div>
  );
}
