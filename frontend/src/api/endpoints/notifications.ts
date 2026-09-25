import { apiRequest } from '../client';
import type { PaginationMeta } from '../../types/api';
import type { AppNotification } from '../../types/entities/notification';

/** Confirmed 1:1 against backend/src/modules/notifications/notifications.controller.ts. */
export const notificationsApi = {
  list: async (params: { page: number; pageSize: number; unreadOnly?: boolean }): Promise<{ items: AppNotification[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<AppNotification[]>({
      method: 'GET',
      url: '/notifications',
      params: { page: params.page, pageSize: params.pageSize, ...(params.unreadOnly ? { unreadOnly: 'true' } : {}) },
    });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  unreadCount: async (): Promise<{ count: number }> => {
    const { data } = await apiRequest<{ count: number }>({ method: 'GET', url: '/notifications/unread-count' });
    return data;
  },
  markRead: async (ids: string[]): Promise<{ updated: number }> => {
    const { data } = await apiRequest<{ updated: number }>({ method: 'POST', url: '/notifications/read', data: { ids } });
    return data;
  },
  markAllRead: async (): Promise<{ updated: number }> => {
    const { data } = await apiRequest<{ updated: number }>({ method: 'POST', url: '/notifications/read-all' });
    return data;
  },
  /** Goes through apiClient on purpose: an expired access token is refreshed by the normal interceptor before the ticket is issued. */
  streamTicket: async (): Promise<{ ticket: string; expiresIn: number }> => {
    const { data } = await apiRequest<{ ticket: string; expiresIn: number }>({ method: 'POST', url: '/notifications/stream-ticket' });
    return data;
  },
};
