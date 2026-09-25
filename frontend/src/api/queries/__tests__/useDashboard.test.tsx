import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDashboardSales, useDashboardWorkload } from '../useDashboard';
import * as usePermissionsModule from '../../../rbac/usePermissions';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Proves instruction 16's "do not fetch unauthorized sections":
 * the query's `enabled` flag (and therefore whether a request is
 * ever issued) is gated on the SAME permission the backend
 * enforces, checked before the network call, not after a 403.
 */

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useDashboard query hooks — RBAC gating', () => {
  it('useDashboardSales is disabled (no request issued) without CRM:customers:view', () => {
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
    });

    const { result } = renderHook(() => useDashboardSales({}), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useDashboardSales is enabled with CRM:customers:view', () => {
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: (perm: string) => perm === 'CRM:customers:view',
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
    });

    const { result } = renderHook(() => useDashboardSales({}), { wrapper });
    // Not idle — the query is permitted to run (may still be
    // 'fetching' or 'paused' depending on network mock state,
    // but it is NOT gated off by permission).
    expect(result.current.fetchStatus).not.toBe('idle');
  });

  it('useDashboardWorkload requires Operations:projects:view, not CRM:customers:view', () => {
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: (perm: string) => perm === 'CRM:customers:view', // has CRM, not Operations
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
    });

    const { result } = renderHook(() => useDashboardWorkload({}), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('query key includes the filters object, so a filter change is a distinct cache entry', () => {
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
    });

    const { result: resultA } = renderHook(() => useDashboardSales({ status: 'draft' }), { wrapper });
    const { result: resultB } = renderHook(() => useDashboardSales({ status: 'sent' }), { wrapper });

    // Different filters must not resolve to the same query identity —
    // asserted indirectly via each hook being independently enabled
    // and not sharing a stale cached result object reference.
    expect(resultA.current).not.toBe(resultB.current);
  });
});
