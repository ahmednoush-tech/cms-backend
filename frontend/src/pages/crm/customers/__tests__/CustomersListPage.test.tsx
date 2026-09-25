import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/testUtils';
import { CustomersListPage } from '../CustomersListPage';
import * as useCustomersModule from '../../../../api/queries/useCustomers';
import { ApiError } from '../../../../api/client';
import { PERMISSIONS } from '../../../../rbac/permissionConstants';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Written as real, runnable Vitest + React Testing Library code.
 *
 * Phase 3F fix: previously mixed two approaches in one file — most
 * tests mocked `usePermissions` directly (bypassing the real
 * PermissionGate logic), but the "loading skeleton" test had no
 * such mock and no AuthContext at all, crashing with "useAuth must
 * be used within an <AuthProvider>." Migrated the whole file to
 * the shared renderWithProviders, which provides a REAL AuthContext
 * value — every test now exercises the actual PermissionGate/
 * usePermissions code path with a real (if minimal) permission set,
 * per the explicit "do not mock away PermissionGate" instruction.
 */

async function renderPage(permissions: string[] = []) {
  return renderWithProviders(<CustomersListPage />, { route: '/crm/customers', permissions });
}

describe('CustomersListPage', () => {
  it('shows a loading skeleton while the list query is pending', async () => {
    vi.spyOn(useCustomersModule, 'useCustomers').mockReturnValue({ data: undefined, isLoading: true, error: null } as any);
    vi.spyOn(useCustomersModule, 'useCreateCustomer').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    await renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows the empty state, with the create action, when there are no customers', async () => {
    vi.spyOn(useCustomersModule, 'useCustomers').mockReturnValue({
      data: { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useCustomersModule, 'useCreateCustomer').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    await renderPage([PERMISSIONS.CRM.customers.create]);
    expect(screen.getByText('No customers yet')).toBeInTheDocument();
  });

  it('renders a backend error using the actual returned message, not a generic one', async () => {
    vi.spyOn(useCustomersModule, 'useCustomers').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError(500, 'INTERNAL_ERROR', 'Database connection lost.'),
    } as any);
    vi.spyOn(useCustomersModule, 'useCreateCustomer').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    await renderPage();
    expect(screen.getByText('Database connection lost.')).toBeInTheDocument();
  });

  it('hides the "New Customer" button when the caller lacks CRM:customers:create', async () => {
    vi.spyOn(useCustomersModule, 'useCustomers').mockReturnValue({
      data: { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useCustomersModule, 'useCreateCustomer').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    // Real PermissionGate, real usePermissions — this permission set
    // deliberately excludes CRM:customers:create (has view only, via
    // route access, but not create).
    await renderPage([PERMISSIONS.CRM.customers.view]);
    expect(screen.queryByText('New Customer')).not.toBeInTheDocument();
  });

  it('renders customer rows with real data when the list is populated', async () => {
    vi.spyOn(useCustomersModule, 'useCustomers').mockReturnValue({
      data: {
        items: [
          {
            id: 'cust-1',
            customerCode: 'CUST-0001',
            companyName: 'Acme Trading',
            email: 'contact@acme.example',
            status: 'active',
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useCustomersModule, 'useCreateCustomer').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    await renderPage();
    expect(screen.getByText('Acme Trading')).toBeInTheDocument();
    expect(screen.getByText('CUST-0001')).toBeInTheDocument();
  });
});
