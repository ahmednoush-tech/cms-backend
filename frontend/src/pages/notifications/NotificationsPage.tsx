import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ApiError } from '../../api/client';
import {
  useNotificationsList,
  useUnreadNotificationCount,
  useMarkNotificationsRead,
  useMarkAllNotificationsRead,
} from '../../api/queries/useNotifications';
import { notificationLink, notificationTitle, relativeTime } from '../../lib/notificationDisplay';
import type { AppNotification } from '../../types/entities/notification';

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const { t, i18n } = useTranslation(['notifications', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading, error } = useNotificationsList({ page, pageSize: PAGE_SIZE, unreadOnly });
  const { data: unread } = useUnreadNotificationCount();
  const markRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();

  const totalPages = data?.meta.totalPages ?? 1;

  const open = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate([n.id]);
    const link = notificationLink(n);
    if (link) navigate(link);
  };

  return (
    <div>
      <PageHeader
        title={t('notifications:title')}
        action={
          (unread?.count ?? 0) > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
            >
              {t('notifications:markAllRead')}
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 inline-flex rounded-lg border border-border bg-surface p-0.5 text-sm">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => { setUnreadOnly(value); setPage(1); }}
            className={`rounded-md px-3 py-1 ${unreadOnly === value ? 'bg-primary text-primary-fg' : 'text-ink-muted hover:text-ink'}`}
          >
            {value ? t('notifications:filter.unread', { count: unread?.count ?? 0 }) : t('notifications:filter.all')}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}
      {data && data.items.length === 0 && (
        <EmptyState title={unreadOnly ? t('notifications:emptyUnread') : t('notifications:empty')} />
      )}

      {data && data.items.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {data.items.map((n) => (
            <li key={n.id}>
              <div className={`flex items-start gap-3 px-4 py-3 ${n.isRead ? '' : 'bg-primary/5'}`}>
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-primary'}`} aria-hidden />
                <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-start">
                  <p className={`text-sm ${n.isRead ? 'text-ink' : 'font-semibold text-ink'}`}>{notificationTitle(t, n)}</p>
                  {n.message && <p className="mt-0.5 text-sm text-ink-muted">{n.message}</p>}
                  <p className="mt-1 text-xs text-ink-muted" title={new Date(n.createdAt).toLocaleString(i18n.language)}>
                    {relativeTime(n.createdAt, i18n.language)}
                  </p>
                </button>
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => markRead.mutate([n.id])}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    {t('notifications:markRead')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-3 py-1 disabled:opacity-40">
            {t('common:pagination.previous', { defaultValue: '‹' })}
          </button>
          <span className="text-ink-muted">{page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-3 py-1 disabled:opacity-40">
            {t('common:pagination.next', { defaultValue: '›' })}
          </button>
        </div>
      )}
    </div>
  );
}
