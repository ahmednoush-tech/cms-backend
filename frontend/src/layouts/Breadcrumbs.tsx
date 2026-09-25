import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { findRouteMeta } from '../routes/routeMap';

/**
 * Derived from routeMap.ts metadata for the current path. Phase
 * 3A only has flat top-level routes, so this renders a single
 * "Dashboard / X" trail; detail pages built in later phases will
 * extend this to fetch a real resource name (e.g. "Customers /
 * Acme Inc. / Contacts") per the design doc.
 */
export function Breadcrumbs() {
  const { t } = useTranslation('nav');
  const location = useLocation();
  const meta = findRouteMeta(location.pathname);

  if (!meta?.navLabelKey) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-ink-muted">
      <Link to="/dashboard" className="hover:text-ink">
        {t('dashboard')}
      </Link>
      {location.pathname !== '/dashboard' && (
        <>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <span className="text-ink">{t(meta.navLabelKey)}</span>
        </>
      )}
    </nav>
  );
}
