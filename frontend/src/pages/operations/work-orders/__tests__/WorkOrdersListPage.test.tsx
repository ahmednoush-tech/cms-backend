import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/testUtils';
import { WorkOrdersListPage } from '../WorkOrdersListPage';
import * as useWorkOrdersModule from '../../../../api/queries/useWorkOrders';
import { PERMISSIONS } from '../../../../rbac/permissionConstants';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Confirms the Operations module renders correctly with Arabic
 * active — same requirement already proven for Dashboard and CRM,
 * applied here. No raw backend status/priority value leaks
 * through untranslated.
 *
 * Phase 3F fix: uses the shared renderWithProviders (real
 * AuthContext + MemoryRouter) instead of a Router-only local
 * helper — this file's "New Work Order" button in PageHeader is
 * behind a real PermissionGate, which crashed with no AuthContext.
 */

async function renderWithArabic() {
  return renderWithProviders(<WorkOrdersListPage />, {
    route: '/ops/work-orders',
    language: 'ar',
    permissions: [PERMISSIONS.Operations.workOrders.view],
  });
}

describe('WorkOrdersListPage — Arabic / RTL rendering', () => {
  it('renders the page title and empty state in Arabic', async () => {
    vi.spyOn(useWorkOrdersModule, 'useWorkOrders').mockReturnValue({
      data: { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useWorkOrdersModule, 'useCreateWorkOrder').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    await renderWithArabic();
    expect(screen.getByText('أوامر العمل')).toBeInTheDocument();
    expect(screen.getByText('لا توجد أوامر عمل بعد')).toBeInTheDocument();
  });

  it('translates status and priority badges rather than showing raw backend values', async () => {
    vi.spyOn(useWorkOrdersModule, 'useWorkOrders').mockReturnValue({
      data: {
        items: [
          {
            id: 'wo-1',
            workOrderNumber: 'WO-2026-0001',
            title: 'صيانة المكيف',
            status: 'in_progress',
            priority: 'urgent',
            dueDate: null,
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useWorkOrdersModule, 'useCreateWorkOrder').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    await renderWithArabic();
    expect(screen.queryByText('in_progress')).not.toBeInTheDocument();
    expect(screen.queryByText('urgent')).not.toBeInTheDocument();
    // Scoped to the table — the Status FilterBar dropdown legitimately
    // has its own "قيد التنفيذ" (in_progress) <option>, so an unscoped
    // getByText finds two matches. The table row's badge is the
    // actual thing under test here.
    const table = within(screen.getByRole('table'));
    expect(table.getByText('قيد التنفيذ')).toBeInTheDocument();
    expect(table.getByText('عاجلة')).toBeInTheDocument();
  });
});
