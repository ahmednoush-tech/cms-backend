import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useProjects } from '../useProjects';
import { useWorkOrders } from '../useWorkOrders';
import { useTasks } from '../useTasks';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Same filter-aware-query-identity requirement established for
 * Dashboard (Phase 3B) and CRM (Phase 3C), applied here.
 */

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('Operations query hooks — filter-aware query identity', () => {
  it('different project status filters produce independently-tracked results', () => {
    const { result: planning } = renderHook(() => useProjects({ status: 'planning' }), { wrapper });
    const { result: completed } = renderHook(() => useProjects({ status: 'completed' }), { wrapper });
    expect(planning.current).not.toBe(completed.current);
  });

  it('different work order projectId filters produce independently-tracked results', () => {
    const { result: a } = renderHook(() => useWorkOrders({ projectId: 'proj-a' }), { wrapper });
    const { result: b } = renderHook(() => useWorkOrders({ projectId: 'proj-b' }), { wrapper });
    expect(a.current).not.toBe(b.current);
  });

  it('different task workOrderId filters produce independently-tracked results', () => {
    const { result: a } = renderHook(() => useTasks({ workOrderId: 'wo-a' }), { wrapper });
    const { result: b } = renderHook(() => useTasks({ workOrderId: 'wo-b' }), { wrapper });
    expect(a.current).not.toBe(b.current);
  });
});
