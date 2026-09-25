import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DashboardFilters } from '../types/dashboard';

const FILTER_KEYS: Array<keyof DashboardFilters> = [
  'dateFrom',
  'dateTo',
  'departmentId',
  'employeeId',
  'customerId',
  'projectId',
  'status',
  'priority',
];

/**
 * Filters live in the URL's query string, not component state —
 * this is what satisfies "preserve current filters when changing
 * dashboard sections" (instruction 6): navigating from /dashboard
 * to /dashboard/sales while filters are active is a normal
 * client-side navigation that carries the same search string
 * forward (the section tabs, in DashboardTabs.tsx, explicitly
 * build their links with the current search string appended).
 * It also means a filtered view is bookmarkable/shareable, a
 * reasonable bonus of this approach rather than its purpose.
 */
export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: DashboardFilters = useMemo(() => {
    const result: DashboardFilters = {};
    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key);
      if (value) result[key] = value;
    }
    return result;
  }, [searchParams]);

  const setFilter = useCallback(
    (key: keyof DashboardFilters, value: string | undefined) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const searchString = searchParams.toString();

  return { filters, setFilter, clearFilters, searchString };
}
