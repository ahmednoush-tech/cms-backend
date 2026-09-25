import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ROUTES, type RouteMeta } from '../routes/routeMap';
import { usePermissions } from '../rbac/usePermissions';
import { getBrandingConfig } from '../config/branding';
import { useCompanyInfo } from '../api/queries/useCompanySettings';
import { resolveAssetUrl } from '../lib/resolveAssetUrl';
import { ThemeSwitcher } from './ThemeSwitcher/ThemeSwitcher';

const GROUP_LABEL_KEYS: Record<string, string> = {
  crm: 'nav:crm',
  operations: 'nav:operations',
  finance: 'nav:finance',
  fleet: 'nav:fleet',
  hr: 'nav:hr',
  payroll: 'nav:payroll',
  administration: 'nav:administration',
};
// Fixed, non-branded colors — deliberately NOT drawn from the
// primary/secondary brand tokens (config/theme.ts), which are set
// per-deployment and would make sections indistinguishable from
// each other and from the active-link highlight on some brand
// palettes. This is purely a scanability aid, same rationale as
// the fixed success/warning/danger tokens already used elsewhere.
// Spelled out as full literal class names (not built with string
// concatenation at runtime) because Tailwind's build only generates
// CSS for class names it can find as literal strings in the source.
const GROUP_BAR_COLORS: Record<string, string> = {
  crm: 'border-sky-500',
  operations: 'border-amber-500',
  finance: 'border-emerald-500',
  fleet: 'border-violet-500',
  hr: 'border-rose-500',
  payroll: 'border-teal-500',
  administration: 'border-slate-500',
};
const GROUP_ORDER: Array<NonNullable<RouteMeta['group']>> = ['dashboard', 'crm', 'operations', 'finance', 'fleet', 'hr', 'payroll', 'administration'];

interface SidebarProps {
  onNavigate?: () => void; // used by MobileNav to close the drawer on click
}

/**
 * Generated from routeMap.ts — the same single source of truth
 * ProtectedRoute reads. A menu item for a route the user lacks
 * permission for is not rendered at all, not shown-disabled
 * (design doc D.4).
 */
export function Sidebar({ onNavigate }: SidebarProps) {
  const { t } = useTranslation(['nav', 'common']);
  const { hasAnyPermission, hasAllPermissions } = usePermissions();
  const branding = getBrandingConfig();
  // Live company info wins once loaded; the static, deploy-time
  // branding config is only a fallback for the brief moment before
  // the first fetch resolves (or if it fails) — never the primary
  // source anymore.
  const { data: company } = useCompanyInfo();
  const displayName = company?.name ?? branding.companyName;
  const displayLogo = resolveAssetUrl(company?.logo) ?? branding.logoUrl;

  const isVisible = (route: RouteMeta) => {
    if (!route.requiredPermissions || route.requiredPermissions.length === 0) return true;
    return route.matchAny
      ? hasAnyPermission(route.requiredPermissions)
      : hasAllPermissions(route.requiredPermissions);
  };

  const visibleRoutes = ROUTES.filter((r) => r.navLabelKey && isVisible(r));
  const ungroupedRoutes = visibleRoutes.filter((r) => !r.group);

  return (
    <nav className="flex h-full w-64 flex-col border-e border-border bg-surface" aria-label="Main navigation">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <img
          src={displayLogo}
          alt={displayName}
          className="h-6"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
        <span className="truncate text-sm font-semibold text-ink">{displayName}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {GROUP_ORDER.map((groupKey) => {
          const groupRoutes = visibleRoutes.filter((r) => r.group === groupKey);
          if (groupRoutes.length === 0) return null;
          return (
            <div key={groupKey} className={clsx('mb-4 border-s-2 ps-2', GROUP_BAR_COLORS[groupKey] ?? 'border-ink-muted')}>
              {GROUP_LABEL_KEYS[groupKey] && (
                <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {t(GROUP_LABEL_KEYS[groupKey])}
                </p>
              )}
              {groupRoutes.map((route) => (
                <SidebarLink key={route.path} to={route.path} labelKey={route.navLabelKey!} onNavigate={onNavigate} />
              ))}
            </div>
          );
        })}
      </div>

      {ungroupedRoutes.length > 0 && (
        <div className="border-t border-border px-2 py-3">
          {ungroupedRoutes.map((route) => (
            <SidebarLink key={route.path} to={route.path} labelKey={route.navLabelKey!} onNavigate={onNavigate} muted />
          ))}
        </div>
      )}

      <div className="border-t border-border">
        <ThemeSwitcher />
      </div>
    </nav>
  );
}

function SidebarLink({
  to,
  labelKey,
  onNavigate,
  muted,
}: {
  to: string;
  labelKey: string;
  onNavigate?: () => void;
  muted?: boolean;
}) {
  const { t } = useTranslation('nav');
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'block rounded px-3 py-2 text-sm',
          isActive
            ? 'bg-primary/10 font-medium text-primary'
            : muted
              ? 'text-ink-muted hover:bg-surface-muted'
              : 'text-ink hover:bg-surface-muted',
        )
      }
    >
      {t(labelKey)}
    </NavLink>
  );
}
