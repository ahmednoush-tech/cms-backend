import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useNotificationsList,
  useUnreadNotificationCount,
  useMarkNotificationsRead,
  useMarkAllNotificationsRead,
} from '../api/queries/useNotifications';
import { notificationLink, notificationTitle, relativeTime } from '../lib/notificationDisplay';
import type { AppNotification } from '../types/entities/notification';

/**
 * Bell + unread badge + dropdown of the latest notifications. The
 * badge count stays live via NotificationStream (mounted at the app
 * root), which updates the same React Query cache this reads from.
 * Replaces the earlier placeholder that linked to an "unavailable
 * feature" page because no notifications API existed yet.
 */
export function NotificationsMenu() {
  const { t, i18n } = useTranslation(['notifications', 'nav']);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: unread } = useUnreadNotificationCount();
  const { data: latest, isLoading } = useNotificationsList({ page: 1, pageSize: 8 });
  const markRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();

  const count = unread?.count ?? 0;

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openNotification = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate([n.id]);
    setOpen(false);
    const link = notificationLink(n);
    if (link) navigate(link);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={count > 0 ? t('notifications:bellWithCount', { count }) : t('nav:notifications')}
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
      >
        <BellIcon />
        {count > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-10 z-40 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-ink">{t('notifications:title')}</p>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                {t('notifications:markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading && <p className="p-4 text-center text-sm text-ink-muted">{t('notifications:loading')}</p>}
            {!isLoading && (latest?.items.length ?? 0) === 0 && (
              <p className="p-6 text-center text-sm text-ink-muted">{t('notifications:empty')}</p>
            )}
            {latest?.items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openNotification(n)}
                className={`flex w-full gap-2 border-b border-border px-3 py-2.5 text-start last:border-b-0 hover:bg-surface-muted ${n.isRead ? '' : 'bg-primary/5'}`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-primary'}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.isRead ? 'text-ink' : 'font-semibold text-ink'}`}>{notificationTitle(t, n)}</span>
                  {n.message && <span className="mt-0.5 block line-clamp-2 text-xs text-ink-muted">{n.message}</span>}
                  <span className="mt-0.5 block text-[11px] text-ink-muted">{relativeTime(n.createdAt, i18n.language)}</span>
                </span>
              </button>
            ))}
          </div>

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-3 py-2 text-center text-xs font-medium text-primary hover:bg-surface-muted"
          >
            {t('notifications:viewAll')}
          </Link>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
