import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';

export function UserMenu() {
  const { t } = useTranslation('common');
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border px-2 py-1 text-sm hover:bg-surface-muted"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg">
            {initials}
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[200px] rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-ink">{user.email}</p>
            {user.roles.length > 0 && <p className="truncate text-xs text-ink-muted">{user.roles.join(', ')}</p>}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            onSelect={() => logout()}
            className="cursor-pointer rounded px-3 py-2 text-sm text-danger outline-none hover:bg-danger/10"
          >
            {t('action.logout')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
