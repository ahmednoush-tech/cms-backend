import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { usePermissions } from '../../rbac/usePermissions';
import { PERMISSIONS } from '../../rbac/permissionConstants';

/**
 * Explicitly appends the current URL search string (the filter
 * state, per useDashboardFilters) to every tab link — this is
 * what makes "preserve current filters when changing dashboard
 * sections" (instruction 6) actually true, rather than accidental.
 * A tab is not rendered at all if the caller lacks that section's
 * permission (same "hide, don't disable" philosophy as Sidebar).
 */
export function DashboardTabs() {
  const { t } = useTranslation('dashboard');
  const location = useLocation();
  const { hasPermission } = usePermissions();

  const tabs = [
    { to: '/dashboard', label: t('tabs.summary'), always: true },
    { to: '/dashboard/sales', label: t('tabs.sales'), permission: PERMISSIONS.CRM.customers.view },
    { to: '/dashboard/operations', label: t('tabs.operations'), permission: PERMISSIONS.Operations.projects.view },
    { to: '/dashboard/workload', label: t('tabs.workload'), permission: PERMISSIONS.Operations.projects.view },
  ].filter((tab) => tab.always || (tab.permission && hasPermission(tab.permission)));

  return (
    <div className="mb-4 flex gap-1 border-b border-border" role="tablist">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={{ pathname: tab.to, search: location.search }}
          end={tab.to === '/dashboard'}
          className={({ isActive }) =>
            clsx(
              'border-b-2 px-3 py-2 text-sm font-medium',
              isActive ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
