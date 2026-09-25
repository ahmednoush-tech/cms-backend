import { apiRequest, apiClient } from '../client';
import type { PaginatedFilters, PaginationMeta } from '../../types/api';
import type { ActivityLog } from '../../types/entities/activityLog';

export interface ActivityLogFilters {
  entityType?: string;
  action?: string;
  /** The actor — who performed the action. */
  userId?: string;
  /** One record's full history (use together with entityType). */
  entityId?: string;
  /** YYYY-MM-DD, inclusive. */
  from?: string;
  /** YYYY-MM-DD, inclusive of the whole day. */
  to?: string;
}

/** Drops empty filters so the query string (and the React Query cache key) stays clean. */
function clean(f: ActivityLogFilters): ActivityLogFilters {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as ActivityLogFilters;
}

/** Confirmed 1:1 against backend/src/modules/activity-logs/activity-logs.controller.ts. Read-only. */
export const activityLogsApi = {
  list: async (filters: PaginatedFilters & ActivityLogFilters): Promise<{ items: ActivityLog[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<ActivityLog[]>({ method: 'GET', url: '/activity-logs', params: clean(filters) });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  /**
   * Authenticated blob download — same approach as report/attachment
   * exports (a plain <a href> can't carry the Bearer token). Returns
   * whether the server hit its row cap, so the UI can say so instead
   * of silently handing over a partial file.
   */
  exportCsv: async (filters: ActivityLogFilters): Promise<{ truncated: boolean }> => {
    const response = await apiClient.get('/activity-logs/export.csv', { params: clean(filters), responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { truncated: response.headers['x-export-truncated'] === 'true' };
  },
};
