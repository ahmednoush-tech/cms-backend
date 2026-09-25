import { useQuery } from '@tanstack/react-query';
import { activityLogsApi, type ActivityLogFilters } from '../endpoints/activityLogs';
import type { PaginatedFilters } from '../../types/api';

export function useActivityLogs(filters: PaginatedFilters & ActivityLogFilters) {
  return useQuery({ queryKey: ['activityLogs', 'list', filters], queryFn: () => activityLogsApi.list(filters) });
}
