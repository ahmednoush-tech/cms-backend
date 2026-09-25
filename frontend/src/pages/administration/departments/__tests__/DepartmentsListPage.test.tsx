import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { DepartmentsListPage } from '../DepartmentsListPage';
import * as useDepartmentsModule from '../../../../api/queries/useDepartments';
import * as usePermissionsModule from '../../../../rbac/usePermissions';
import { ApiError } from '../../../../api/client';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 */

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/admin/departments']}>
          <DepartmentsListPage />
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

function mockData(items: Array<{ id: string; name: string; status: string; managerId: string | null }> = []) {
  vi.spyOn(useDepartmentsModule, 'useDepartments').mockReturnValue({
    data: { items, meta: { page: 1, pageSize: 20, total: items.length, totalPages: items.length ? 1 : 0 } },
    isLoading: false,
    error: null,
  } as any);
  vi.spyOn(useDepartmentsModule, 'useCreateDepartment').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.spyOn(useDepartmentsModule, 'useUpdateDepartment').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
}

describe('DepartmentsListPage', () => {
  it('shows the empty state when there are no departments', () => {
    mockData([]);
    vi.spyOn(useDepartmentsModule, 'useDeleteDepartment').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({ hasPermission: () => true, hasAnyPermission: () => true, hasAllPermissions: () => true });

    renderPage();
    expect(screen.getByText('No departments yet')).toBeInTheDocument();
  });

  it('hides Edit/Delete row actions when the caller lacks the corresponding permission', () => {
    mockData([{ id: 'd1', name: 'Engineering', status: 'active', managerId: null }]);
    vi.spyOn(useDepartmentsModule, 'useDeleteDepartment').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
    });

    renderPage();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('surfaces the real backend 409/422 message verbatim when deletion is blocked by active employees', async () => {
    mockData([{ id: 'd1', name: 'Engineering', status: 'active', managerId: null }]);
    const mutate = vi.fn((_id, options) => {
      options.onError(new ApiError(422, 'BUSINESS_RULE_VIOLATION', 'Cannot delete a department with active employees assigned.'));
    });
    vi.spyOn(useDepartmentsModule, 'useDeleteDepartment').mockReturnValue({ mutate, isPending: false } as any);
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({ hasPermission: () => true, hasAnyPermission: () => true, hasAllPermissions: () => true });

    renderPage();
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(screen.getByText('Cannot delete a department with active employees assigned.')).toBeInTheDocument();
    });
  });

  it('translates status values rather than showing raw backend strings', () => {
    mockData([{ id: 'd1', name: 'Sales', status: 'inactive', managerId: null }]);
    vi.spyOn(useDepartmentsModule, 'useDeleteDepartment').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({ hasPermission: () => true, hasAnyPermission: () => true, hasAllPermissions: () => true });

    renderPage();
    expect(screen.queryByText('inactive')).not.toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});
