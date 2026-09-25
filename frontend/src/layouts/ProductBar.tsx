import { useTranslation } from 'react-i18next';
import { usePlatformSettingsPublic } from '../api/queries/usePlatformSettings';

/**
 * Always identical across every company using the product — this
 * is Mizan's OWN identity, separate from whichever company is
 * currently logged in. The tenant's own name/logo (Arkan, or any
 * other customer) renders inside Sidebar, one level below this —
 * see Sidebar.tsx's displayName/displayLogo.
 *
 * Name/tagline/logo are now fetched LIVE from GET
 * /platform-settings (editable by Mizan's own team — see
 * PlatformAdminSettingsPage) rather than the static
 * common:productName/productTagline translation keys, which now
 * serve only as the fallback shown before the fetch resolves (or
 * if it ever fails) — the SAME "server data with a static
 * fallback" pattern already used for the tenant's own name/logo in
 * Sidebar.tsx.
 */
export function ProductBar() {
  const { t } = useTranslation(['common']);
  const { data: settings } = usePlatformSettingsPublic();

  const displayName = settings?.productName ?? t('common:productName');
  const displayTagline = settings?.productTagline ?? t('common:productTagline');

  return (
    <div className="flex h-8 shrink-0 items-center justify-between bg-primary px-4 text-primary-fg">
      <div className="flex items-center gap-2 text-xs font-semibold">
        {settings?.logoUrl ? (
          <img src={settings.logoUrl} alt={displayName} className="h-3.5 w-3.5" />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 3v18M6 7l-4 6h8l-4-6zM18 7l-4 6h8l-4-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        )}
        {displayName}
      </div>
      <div className="hidden text-[11px] opacity-80 sm:block">{displayTagline}</div>
    </div>
  );
}
