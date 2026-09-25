import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../endpoints/dashboard';
import type { DashboardFilters } from '../../types/dashboard';
import { usePermissions } from '../../rbac/usePermissions';
import { PERMISSIONS, DASHBOARD_SUMMARY_ANY_OF } from '../../rbac/permissionConstants';

/**
 * Every hook's query key includes the full filters object, per
 * instruction 16 — a filter change is a different cache entry,
 * never a stale one silently reused. `enabled` is gated on the
 * SAME permission check the backend enforces (instruction 11) —
 * we never issue a request for a section the caller lacks
 * permission for, rather than firing it and letting a 403 land
 * (instruction 16: "do not fetch unauthorized sections").
 *
 * /summary is the one exception: its OR-based access rule means
 * "enabled" only requires having a request AT ALL (any dashboard
 * permission) — the backend itself decides which sections to
 * include in the response body, and the frontend renders exactly
 * what comes back (see DashboardSummaryPage).
 */

export function useDashboardSummary(filters: DashboardFilters) {
  const { hasAnyPermission } = usePermissions();
  const enabled = hasAnyPermission(DASHBOARD_SUMMARY_ANY_OF);

  return useQuery({
    queryKey: ['dashboard', 'summary', filters],
    queryFn: () => dashboardApi.summary(filters),
    enabled,
  });
}

export function useDashboardSales(filters: DashboardFilters) {
  const { hasPermission } = usePermissions();
  const enabled = hasPermission(PERMISSIONS.CRM.customers.view);

  return useQuery({
    queryKey: ['dashboard', 'sales', filters],
    queryFn: () => dashboardApi.sales(filters),
    enabled,
  });
}

export function useDashboardOperations(filters: DashboardFilters) {
  const { hasPermission } = usePermissions();
  const enabled = hasPermission(PERMISSIONS.Operations.projects.view);

  return useQuery({
    queryKey: ['dashboard', 'operations', filters],
    queryFn: () => dashboardApi.operations(filters),
    enabled,
  });
}

export function useDashboardWorkload(filters: DashboardFilters) {
  const { hasPermission } = usePermissions();
  const enabled = hasPermission(PERMISSIONS.Operations.projects.view);

  return useQuery({
    queryKey: ['dashboard', 'workload', filters],
    queryFn: () => dashboardApi.workload(filters),
    enabled,
  });
}
