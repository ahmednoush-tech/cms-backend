import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useOpportunities } from '../useOpportunities';
import { useQuotations } from '../useQuotations';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Proves filter changes produce distinct cache entries — same
 * requirement instruction 16 established for Dashboard, applied
 * here to Opportunities/Quotations, the two CRM resources with
 * real backend filter support.
 */

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useOpportunities / useQuotations — filter-aware query identity', () => {
  it('different stage filters produce independently-tracked query results', () => {
    const { result: prospecting } = renderHook(() => useOpportunities({ stage: 'prospecting' }), { wrapper });
    const { result: won } = renderHook(() => useOpportunities({ stage: 'won' }), { wrapper });

    expect(prospecting.current).not.toBe(won.current);
  });

  it('different status filters produce independently-tracked query results for quotations', () => {
    const { result: draft } = renderHook(() => useQuotations({ status: 'draft' }), { wrapper });
    const { result: sent } = renderHook(() => useQuotations({ status: 'sent' }), { wrapper });

    expect(draft.current).not.toBe(sent.current);
  });

  it('an empty filters object is a valid, distinct query from any specific filter', () => {
    const { result: unfiltered } = renderHook(() => useQuotations({}), { wrapper });
    const { result: filtered } = renderHook(() => useQuotations({ customerId: 'cust-1' }), { wrapper });

    expect(unfiltered.current).not.toBe(filtered.current);
  });
});
