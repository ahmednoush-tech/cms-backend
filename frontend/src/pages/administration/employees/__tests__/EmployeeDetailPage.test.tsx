import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { EmployeeDetailPage } from '../EmployeeDetailPage';
import * as useEmployeesModule from '../../../../api/queries/useEmployees';
import * as usePermissionsModule from '../../../../rbac/usePermissions';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 */

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/admin/employees/e1']}>
          <Routes>
            <Route path="/admin/employees/:id" element={<EmployeeDetailPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

function allowAll() {
  vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
}

describe('EmployeeDetailPage', () => {
  it('displays the nested department and manager names when present (findOne includes them)', () => {
    vi.spyOn(useEmployeesModule, 'useEmployee').mockReturnValue({
      data: {
        id: 'e1',
        employeeNumber: 'EMP-001',
        firstName: 'Sara',
        lastName: 'Ahmed',
        status: 'active',
        jobTitle: 'Engineer',
        email: null,
        phone: null,
        hireDate: null,
        department: { id: 'd1', name: 'Engineering' },
        manager: { id: 'm1', firstName: 'Omar', lastName: 'Khaled' },
        user: null,
      },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useEmployeesModule, 'useUpdateEmployee').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(useEmployeesModule, 'useLinkEmployeeUser').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    allowAll();

    renderPage();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Omar Khaled')).toBeInTheDocument();
  });

  it('shows the Link Login Access form when the employee has no linked user', () => {
    vi.spyOn(useEmployeesModule, 'useEmployee').mockReturnValue({
      data: {
        id: 'e1',
        employeeNumber: 'EMP-001',
        firstName: 'Sara',
        lastName: 'Ahmed',
        status: 'active',
        jobTitle: null,
        email: null,
        phone: null,
        hireDate: null,
        department: null,
        manager: null,
        user: null,
      },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useEmployeesModule, 'useUpdateEmployee').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(useEmployeesModule, 'useLinkEmployeeUser').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    allowAll();

    renderPage();
    expect(screen.getByText('Link Login Access')).toBeInTheDocument();
  });

  it('hides the Link Login Access form entirely once a user is already linked — no unlink endpoint exists', () => {
    vi.spyOn(useEmployeesModule, 'useEmployee').mockReturnValue({
      data: {
        id: 'e1',
        employeeNumber: 'EMP-001',
        firstName: 'Sara',
        lastName: 'Ahmed',
        status: 'active',
        jobTitle: null,
        email: null,
        phone: null,
        hireDate: null,
        department: null,
        manager: null,
        user: { id: 'u1', email: 'sara@example.com', status: 'active' },
      },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useEmployeesModule, 'useUpdateEmployee').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(useEmployeesModule, 'useLinkEmployeeUser').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    allowAll();

    renderPage();
    expect(screen.queryByText('Link Login Access')).not.toBeInTheDocument();
    expect(screen.getByText('sara@example.com')).toBeInTheDocument();
  });
});
