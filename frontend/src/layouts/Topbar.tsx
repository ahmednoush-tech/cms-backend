import { Breadcrumbs } from './Breadcrumbs';
import { NotificationsMenu } from './NotificationsMenu';
import { UserMenu } from './UserMenu';
import { LanguageSwitcher } from './LanguageSwitcher';

interface TopbarProps {
  onOpenMobileNav: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="flex h-8 w-8 items-center justify-center rounded text-ink hover:bg-surface-muted md:hidden"
          aria-label="Open navigation menu"
        >
          <MenuIcon />
        </button>
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
