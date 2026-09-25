import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/testUtils';
import { DashboardSummaryPage } from '../DashboardSummaryPage';
import * as dashboardQueries from '../../../api/queries/useDashboard';
import { ApiError } from '../../../api/client';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Written as real, runnable Vitest + React Testing Library code.
 *
 * Phase 3F fix: DashboardSummaryPage renders via useDashboardFilters(),
 * which calls React Router's useSearchParams() — this crashed with
 * "useLocation() may be used only in the context of a <Router>
 * component" because this file's local render helper had no Router
 * at all. Now uses the shared renderWithProviders (real MemoryRouter
 * + real AuthContext), per the Phase 3F harness fix.
 */

describe('DashboardSummaryPage', () => {
  it('shows a loading skeleton while the query is pending', async () => {
    vi.spyOn(dashboardQueries, 'useDashboardSummary').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof dashboardQueries.useDashboardSummary>);

    await renderWithProviders(<DashboardSummaryPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders an ErrorState on a backend error, using the actual backend message', async () => {
    vi.spyOn(dashboardQueries, 'useDashboardSummary').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError(500, 'INTERNAL_ERROR', 'Something broke on the server.'),
    } as unknown as ReturnType<typeof dashboardQueries.useDashboardSummary>);

    await renderWithProviders(<DashboardSummaryPage />);
    expect(screen.getByText('Something broke on the server.')).toBeInTheDocument();
  });

  it('renders ONLY CRM KPI cards when the backend response omits the Operations fields (partial-permission case)', async () => {
    vi.spyOn(dashboardQueries, 'useDashboardSummary').mockReturnValue({
      data: {
        totalCustomers: 12,
        newLeads: 3,
        openOpportunities: 5,
        pipelineValue: '45000.00',
        // activeProjects, openWorkOrders, etc. are deliberately
        // ABSENT here — this is exactly what the backend returns
        // for a CRM-only-permission caller (confirmed this session).
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof dashboardQueries.useDashboardSummary>);

    await renderWithProviders(<DashboardSummaryPage />);

    expect(screen.getByText('12')).toBeInTheDocument(); // totalCustomers
    // Operations KPI labels must not appear at all — not as "0".
    expect(screen.queryByText(/Active Projects/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Open Work Orders/i)).not.toBeInTheDocument();
  });

  it('renders ONLY Operations KPI cards when the backend response omits the CRM fields', async () => {
    vi.spyOn(dashboardQueries, 'useDashboardSummary').mockReturnValue({
      data: {
        activeProjects: 4,
        completedProjects: 9,
        openWorkOrders: 6,
        overdueWorkOrders: 1,
        pendingTasks: 10,
        completedTasks: 20,
        totalOpenAssignments: 16,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof dashboardQueries.useDashboardSummary>);

    await renderWithProviders(<DashboardSummaryPage />);

    expect(screen.getByText('4')).toBeInTheDocument(); // activeProjects
    expect(screen.queryByText(/Total Customers/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pipeline Value/i)).not.toBeInTheDocument();
  });

  it('renders the full grid when both CRM and Operations fields are present', async () => {
    vi.spyOn(dashboardQueries, 'useDashboardSummary').mockReturnValue({
      data: {
        totalCustomers: 12,
        newLeads: 3,
        openOpportunities: 5,
        pipelineValue: '45000.00',
        activeProjects: 4,
        completedProjects: 9,
        openWorkOrders: 6,
        overdueWorkOrders: 1,
        pendingTasks: 10,
        completedTasks: 20,
        totalOpenAssignments: 16,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof dashboardQueries.useDashboardSummary>);

    await renderWithProviders(<DashboardSummaryPage />);

    expect(screen.getByText(/Total Customers/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Projects/i)).toBeInTheDocument();
  });
});
