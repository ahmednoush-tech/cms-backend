import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { API_BASE_URL } from '../api/client';
import { notificationsApi } from '../api/endpoints/notifications';
import { NOTIFICATIONS_KEY } from '../api/queries/useNotifications';
import { notificationLink, notificationTitle } from '../lib/notificationDisplay';
import type { AppNotification } from '../types/entities/notification';

/** Server pings every 25s; if nothing at all arrives for this long, the connection is presumed silently dead. */
const WATCHDOG_MS = 60_000;
const MAX_BACKOFF_MS = 60_000;
const TOAST_MS = 6_000;
const MAX_TOASTS = 3;

/**
 * Mounted ONCE, at the app root next to the router (see App.tsx) —
 * not inside AppLayout, which every route renders separately and
 * which could otherwise tear down and reopen the connection on page
 * navigation.
 *
 * Connection lifecycle:
 * 1. Ask for a short-lived ticket through the normal authenticated
 *    API (so an expired access token gets refreshed first).
 * 2. Open the EventSource with that ticket.
 * 3. On `ready`: re-sync the badge/list — anything that arrived
 *    while disconnected is picked up here, so nothing is ever lost,
 *    only (at worst) delayed.
 * 4. On `reconnect` (server's planned 30-minute rotation) or any
 *    error: close, and go back to step 1 with a fresh ticket.
 *    The browser's own built-in auto-reconnect is deliberately NOT
 *    relied on: it would retry with the same, by-then-expired ticket.
 * 5. Watchdog: if no event (not even the 25s ping) arrives for 60s,
 *    the connection is treated as dead and reopened — this is what
 *    recovers after a laptop wakes from sleep or the network changes,
 *    cases where the browser itself may never notice.
 */
export function NotificationStream({ onOpen }: { onOpen: (path: string) => void }) {
  const { status, user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation(['notifications']);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const toastTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const enabled = status === 'authenticated' && !!user && !user.isCustomerUser;

  const dismissToast = useCallback((id: string) => {
    setToasts((list) => list.filter((n) => n.id !== id));
    const timer = toastTimers.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimers.current.delete(id);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let source: EventSource | null = null;
    let stopped = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;

    const resync = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });

    const armWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
      watchdog = setTimeout(() => restart(false), WATCHDOG_MS);
    };

    const closeSource = () => {
      if (watchdog) clearTimeout(watchdog);
      source?.close();
      source = null;
    };

    const scheduleRetry = () => {
      if (stopped) return;
      // 2s, 4s, 8s ... capped at 60s, with jitter so every tab of a
      // restarted server doesn't reconnect in the same instant.
      const base = Math.min(MAX_BACKOFF_MS, 2000 * 2 ** attempt);
      attempt += 1;
      retryTimer = setTimeout(connect, base / 2 + Math.random() * (base / 2));
    };

    /** planned=true for the server's own 30-minute rotation: reconnect right away, no backoff. */
    const restart = (planned: boolean) => {
      closeSource();
      if (stopped) return;
      if (planned) {
        attempt = 0;
        void connect();
      } else {
        scheduleRetry();
      }
    };

    const connect = async () => {
      if (stopped) return;
      let ticket: string;
      try {
        ({ ticket } = await notificationsApi.streamTicket());
      } catch {
        scheduleRetry();
        return;
      }
      if (stopped) return;

      const es = new EventSource(`${API_BASE_URL}/notifications/stream?ticket=${encodeURIComponent(ticket)}`);
      source = es;
      armWatchdog();

      es.addEventListener('ready', () => {
        attempt = 0;
        armWatchdog();
        resync();
      });
      es.addEventListener('ping', armWatchdog);
      es.addEventListener('notification', (e) => {
        armWatchdog();
        let n: AppNotification;
        try {
          n = JSON.parse((e as MessageEvent).data);
        } catch {
          return;
        }
        if (!n.isRead) {
          queryClient.setQueryData<{ count: number }>([...NOTIFICATIONS_KEY, 'unread-count'], (old) => ({ count: (old?.count ?? 0) + 1 }));
        }
        queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, 'list'] });
        setToasts((list) => [n, ...list.filter((x) => x.id !== n.id)].slice(0, MAX_TOASTS));
        toastTimers.current.set(n.id, setTimeout(() => dismissToast(n.id), TOAST_MS));
      });
      // Marked read in another tab (or on another device of the same user).
      es.addEventListener('read', () => {
        armWatchdog();
        resync();
      });
      es.addEventListener('reconnect', () => restart(true));
      es.onerror = () => restart(false);
    };

    void connect();

    const timers = toastTimers.current;
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      closeSource();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      setToasts([]);
    };
  }, [enabled, queryClient, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {toasts.map((n) => {
        const link = notificationLink(n);
        return (
          <div key={n.id} className="pointer-events-auto rounded-lg border border-border bg-surface p-3 shadow-lg">
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-start"
                onClick={() => {
                  dismissToast(n.id);
                  void notificationsApi.markRead([n.id]).then(() => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }));
                  if (link) onOpen(link);
                }}
              >
                <p className="text-sm font-semibold text-ink">{notificationTitle(t, n)}</p>
                {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{n.message}</p>}
              </button>
              <button type="button" aria-label={t('notifications:dismiss')} onClick={() => dismissToast(n.id)} className="text-ink-muted hover:text-ink">
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
