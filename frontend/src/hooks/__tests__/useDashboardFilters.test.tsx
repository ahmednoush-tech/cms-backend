import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useDashboardFilters } from '../useDashboardFilters';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 */

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={['/dashboard']}>{children}</MemoryRouter>;
}

describe('useDashboardFilters', () => {
  it('starts with no filters on a clean URL', () => {
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });
    expect(result.current.filters).toEqual({});
  });

  it('setFilter updates the URL search string and the derived filters object', () => {
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });

    act(() => {
      result.current.setFilter('status', 'in_progress');
    });

    expect(result.current.filters.status).toBe('in_progress');
    expect(result.current.searchString).toContain('status=in_progress');
  });

  it('setFilter with undefined removes the key entirely (not set to empty string)', () => {
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });

    act(() => {
      result.current.setFilter('priority', 'high');
    });
    act(() => {
      result.current.setFilter('priority', undefined);
    });

    expect('priority' in result.current.filters).toBe(false);
  });

  it('clearFilters removes every filter at once', () => {
    const { result } = renderHook(() => useDashboardFilters(), { wrapper });

    act(() => {
      result.current.setFilter('status', 'draft');
      result.current.setFilter('priority', 'low');
    });
    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters).toEqual({});
    expect(result.current.searchString).toBe('');
  });

  it('only reads the seven approved DashboardFiltersDto keys, ignoring any unrelated query param', () => {
    // Simulates a URL carrying an unrelated param (e.g. from
    // browser history) — must not leak into the filters object
    // sent to the backend, since the backend's whitelist pipe
    // would reject it outright.
    function wrapperWithExtraParam({ children }: { children: ReactNode }) {
      return <MemoryRouter initialEntries={['/dashboard?status=sent&notAFilter=x']}>{children}</MemoryRouter>;
    }
    const { result } = renderHook(() => useDashboardFilters(), { wrapper: wrapperWithExtraParam });

    expect(result.current.filters).toEqual({ status: 'sent' });
    expect('notAFilter' in result.current.filters).toBe(false);
  });
});
