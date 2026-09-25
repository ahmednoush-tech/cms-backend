import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/testUtils';
import { EmployeesListPage } from '../EmployeesListPage';
import * as useEmployeesModule from '../../../../api/queries/useEmployees';
import { PERMISSIONS } from '../../../../rbac/permissionConstants';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Phase 3F fix: this file never provided an AuthContext at all,
 * so any render exercising the real PermissionGate (the "New
 * Employee" button in PageHeader) crashed with "useAuth must be
 * used within an <AuthProvider>." Now uses the shared
 * renderWithProviders with a real, minimal permission set — the
 * real PermissionGate/usePermissions code runs, never mocked.
 */

async function renderWithArabic() {
  return renderWithProviders(<EmployeesListPage />, {
    route: '/admin/employees',
    language: 'ar',
    permissions: [PERMISSIONS.Administration.employees.view],
  });
}

describe('EmployeesListPage — Arabic / RTL rendering', () => {
  it('renders the page title and empty state in Arabic', async () => {
    vi.spyOn(useEmployeesModule, 'useEmployees').mockReturnValue({
      data: { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useEmployeesModule, 'useCreateEmployee').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    await renderWithArabic();
    expect(screen.getByText('الموظفون')).toBeInTheDocument();
    expect(screen.getByText('لا يوجد موظفون بعد')).toBeInTheDocument();
  });

  it('translates the employee status rather than showing the raw backend value', async () => {
    vi.spyOn(useEmployeesModule, 'useEmployees').mockReturnValue({
      data: {
        items: [
          {
            id: 'e1',
            employeeNumber: 'EMP-001',
            firstName: 'سارة',
            lastName: 'أحمد',
            jobTitle: null,
            status: 'terminated',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useEmployeesModule, 'useCreateEmployee').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    await renderWithArabic();
    expect(screen.queryByText('terminated')).not.toBeInTheDocument();
    expect(screen.getByText('منتهي الخدمة')).toBeInTheDocument();
  });
});
