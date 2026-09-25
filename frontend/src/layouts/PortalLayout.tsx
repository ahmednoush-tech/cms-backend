import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { getBrandingConfig } from '../config/branding';
import { usePublicCompanyInfo } from '../api/queries/useCompanySettings';
import { resolveAssetUrl } from '../lib/resolveAssetUrl';
import { LanguageSwitcher } from './LanguageSwitcher';

const NAV_ITEMS = [
  { path: '/portal/quotations', labelKey: 'portal:nav.quotations' },
  { path: '/portal/invoices', labelKey: 'portal:nav.invoices' },
  { path: '/portal/projects', labelKey: 'portal:nav.projects' },
  { path: '/portal/statement', labelKey: 'portal:nav.statement' },
];

/**
 * Deliberately separate from AppLayout/Sidebar — the portal's nav
 * is small, fixed, and identical for every customer (no
 * permission-gating like the internal Sidebar does), so it isn't
 * worth sharing that more complex component just to get four
 * always-visible links.
 */
export function PortalLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation(['portal', 'common']);
  const { user, logout } = useAuth();
  const branding = getBrandingConfig();
  // Portal customers are @PortalOnly() — they cannot reach the
  // @InternalOnly() /company-settings endpoint, so this uses the
  // SAME public, unauthenticated endpoint the pre-login screens
  // use, not useCompanyInfo().
  const { data: company } = usePublicCompanyInfo();
  const displayName = company?.name ?? branding.companyName;
  const displayLogo = resolveAssetUrl(company?.logo) ?? branding.logoUrl;

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img
              src={displayLogo}
              alt={displayName}
              className="h-6"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <span className="text-sm font-semibold text-ink">{displayName}</span>
            <span className="text-xs text-ink-muted">— {t('portal:title')}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <span className="hidden text-sm text-ink-muted sm:inline">{user?.email}</span>
            <button type="button" onClick={() => logout()} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('common:action.logout')}
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4" aria-label={t('portal:title')}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `border-b-2 px-3 py-2 text-sm font-medium ${isActive ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink'}`
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
