import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { EmptyState } from '../../components/EmptyState/EmptyState';

interface UnavailableFeaturePageProps {
  titleKey: string;
  messageKey: string;
}

/**
 * Used for /notifications and /activity-log — per Phase 3A
 * decision 5: the backend writes to both tables extensively
 * (confirmed — ActivityLogService.record() and
 * prisma.notification.create() calls exist throughout the CRM/
 * Operations services) but exposes NEITHER for reading (no
 * NotificationsController/ActivityLogController exists). This
 * page states that honestly rather than rendering a fake/mocked
 * list — no invented endpoint is called here.
 */
export function UnavailableFeaturePage({ titleKey, messageKey }: UnavailableFeaturePageProps) {
  const { t } = useTranslation(['nav', 'common']);
  return (
    <div>
      <PageHeader title={t(titleKey)} />
      <EmptyState title={t('common:unavailable.title')} description={t(messageKey)} />
    </div>
  );
}
