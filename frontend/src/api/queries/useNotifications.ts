import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../endpoints/notifications';

/** Every notification query lives under this prefix, so one invalidate refreshes the badge, the dropdown and the page together. */
export const NOTIFICATIONS_KEY = ['notifications'] as const;

export function useNotificationsList(params: { page: number; pageSize: number; unreadOnly?: boolean }) {
  return useQuery({ queryKey: [...NOTIFICATIONS_KEY, 'list', params], queryFn: () => notificationsApi.list(params) });
}

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    enabled,
    // The live stream keeps this fresh; this interval is only a
    // fallback for when the stream is down (e.g. a strict corporate
    // proxy that blocks long-lived connections).
    refetchInterval: 120_000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => notificationsApi.markRead(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
}
