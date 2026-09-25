import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDepartments } from '../useDepartments';
import { useEmployees } from '../useEmployees';
import { useAdminUsers } from '../useAdminUsers';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Departments/Employees/Users all support `search` (confirmed —
 * base PaginationQueryDto), so search-aware query identity is
 * what's testable here — unlike Projects/Quotations, there is no
 * dedicated filter DTO for any of these three, so no status/
 * department filter identity test exists (there's nothing to
 * filter by beyond search+pagination).
 */

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('Administration query hooks — search-aware query identity', () => {
  it('different department search terms produce independently-tracked results', () => {
    const { result: a } = renderHook(() => useDepartments({ search: 'Sales' }), { wrapper });
    const { result: b } = renderHook(() => useDepartments({ search: 'Engineering' }), { wrapper });
    expect(a.current).not.toBe(b.current);
  });

  it('different employee search terms produce independently-tracked results', () => {
    const { result: a } = renderHook(() => useEmployees({ search: 'Ahmed' }), { wrapper });
    const { result: b } = renderHook(() => useEmployees({ search: 'Sara' }), { wrapper });
    expect(a.current).not.toBe(b.current);
  });

  it('different user page numbers produce independently-tracked results', () => {
    const { result: p1 } = renderHook(() => useAdminUsers({ page: 1 }), { wrapper });
    const { result: p2 } = renderHook(() => useAdminUsers({ page: 2 }), { wrapper });
    expect(p1.current).not.toBe(p2.current);
  });
});
