import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { DashboardTabs } from '../../components/dashboard/DashboardTabs';
import { DashboardFilterBar } from '../../components/dashboard/DashboardFilterBar';

/**
 * Parent route for /dashboard, /dashboard/sales, /dashboard/operations,
 * /dashboard/workload — the filter bar and tab navigation render
 * once here and persist across section switches (instruction 6),
 * with only the section content (<Outlet/>) changing.
 */
export function DashboardShell() {
  const { t } = useTranslation('dashboard');
  return (
    <div>
      <PageHeader title={t('title')} />
      <DashboardTabs />
      <DashboardFilterBar />
      <Outlet />
    </div>
  );
}
