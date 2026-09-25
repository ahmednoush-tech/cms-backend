import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { WorkOrderDetailPage } from '../WorkOrderDetailPage';
import * as useWorkOrdersModule from '../../../../api/queries/useWorkOrders';
import * as usePermissionsModule from '../../../../rbac/usePermissions';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 */

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/ops/work-orders/wo-1']}>
          <Routes>
            <Route path="/ops/work-orders/:id" element={<WorkOrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

function mockWorkOrder(status: string, priority = 'high') {
  vi.spyOn(useWorkOrdersModule, 'useWorkOrder').mockReturnValue({
    data: {
      id: 'wo-1',
      workOrderNumber: 'WO-2026-0001',
      title: 'Replace HVAC filter',
      description: null,
      status,
      priority,
      assignedToEmployeeId: null,
      dueDate: null,
    },
    isLoading: false,
    error: null,
  } as any);
}

function allowAll() {
  vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
}

describe('WorkOrderDetailPage', () => {
  it('shows status and priority badges', () => {
    mockWorkOrder('assigned', 'urgent');
    vi.spyOn(useWorkOrdersModule, 'useUpdateWorkOrderStatus').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(useWorkOrdersModule, 'useAssignWorkOrder').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    allowAll();

    renderPage();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('only offers transitions valid from "new" (assigned/cancelled, never directly to in_progress)', () => {
    mockWorkOrder('new');
    vi.spyOn(useWorkOrdersModule, 'useUpdateWorkOrderStatus').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(useWorkOrdersModule, 'useAssignWorkOrder').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    allowAll();

    renderPage();
    expect(screen.getByText('Move to Assigned')).toBeInTheDocument();
    expect(screen.getByText('Move to Cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Move to In Progress')).not.toBeInTheDocument();
  });

  it('allows reassignment (Assign action visible) at any non-terminal status, per the backend rule', () => {
    mockWorkOrder('in_progress');
    vi.spyOn(useWorkOrdersModule, 'useUpdateWorkOrderStatus').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(useWorkOrdersModule, 'useAssignWorkOrder').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    allowAll();

    renderPage();
    expect(screen.getAllByText('Assign').length).toBeGreaterThan(0);
  });

  it('hides the Assign action when the caller lacks Operations:work_orders:assign', () => {
    mockWorkOrder('new');
    vi.spyOn(useWorkOrdersModule, 'useUpdateWorkOrderStatus').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(useWorkOrdersModule, 'useAssignWorkOrder').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: (perm: string) => perm !== 'Operations:work_orders:assign',
      hasAnyPermission: () => true,
      hasAllPermissions: (perms: readonly string[]) => !perms.includes('Operations:work_orders:assign'),
    });

    renderPage();
    expect(screen.queryByPlaceholderText('Employee ID')).not.toBeInTheDocument();
  });
});
