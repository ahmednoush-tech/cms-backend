import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { ProjectDetailPage } from '../ProjectDetailPage';
import * as useProjectsModule from '../../../../api/queries/useProjects';
import * as usePermissionsModule from '../../../../rbac/usePermissions';
import { ApiError } from '../../../../api/client';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * The completion-gating test below is the most important one in
 * this file: "Complete" is a structurally valid transition from
 * in_progress per PROJECT_TRANSITIONS, so the button IS offered,
 * but the backend can still 422 it if open work orders exist.
 * This proves that real backend message is surfaced verbatim,
 * never predicted or silently swallowed.
 */

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/ops/projects/proj-1']}>
          <Routes>
            <Route path="/ops/projects/:id" element={<ProjectDetailPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

function mockProject(status: string) {
  vi.spyOn(useProjectsModule, 'useProject').mockReturnValue({
    data: {
      id: 'proj-1',
      projectNumber: 'PRJ-2026-0001',
      name: 'Warehouse Fitout',
      description: null,
      status,
      startDate: null,
      endDate: null,
      projectManagerId: null,
    },
    isLoading: false,
    error: null,
  } as any);
  vi.spyOn(useProjectsModule, 'useProjectMembers').mockReturnValue({ data: [], isLoading: false } as any);
  vi.spyOn(useProjectsModule, 'useAddProjectMember').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.spyOn(useProjectsModule, 'useRemoveProjectMember').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
}

function allowAll() {
  vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
}

describe('ProjectDetailPage', () => {
  it('offers only the transitions valid from the current status (in_progress -> on_hold/completed/cancelled)', () => {
    mockProject('in_progress');
    vi.spyOn(useProjectsModule, 'useUpdateProjectStatus').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(useProjectsModule, 'useAssignProjectManager').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    allowAll();

    renderPage();
    expect(screen.getByText('Move to On Hold')).toBeInTheDocument();
    expect(screen.getByText('Move to Completed')).toBeInTheDocument();
    expect(screen.getByText('Move to Cancelled')).toBeInTheDocument();
  });

  it('offers NO status transitions at all for a terminal status (completed)', () => {
    mockProject('completed');
    vi.spyOn(useProjectsModule, 'useUpdateProjectStatus').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(useProjectsModule, 'useAssignProjectManager').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    allowAll();

    renderPage();
    expect(screen.queryByText(/Move to/)).not.toBeInTheDocument();
  });

  it('surfaces the real backend 422 message verbatim when completion is blocked by open work orders', async () => {
    mockProject('in_progress');
    const mutate = vi.fn((_input, options) => {
      options.onError(new ApiError(422, 'BUSINESS_RULE_VIOLATION', 'Cannot complete this project — 2 work order(s) are not yet completed or cancelled.'));
    });
    vi.spyOn(useProjectsModule, 'useUpdateProjectStatus').mockReturnValue({ mutate, isPending: false } as any);
    vi.spyOn(useProjectsModule, 'useAssignProjectManager').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    allowAll();

    renderPage();
    fireEvent.click(screen.getByText('Move to Completed'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(
        screen.getByText('Cannot complete this project — 2 work order(s) are not yet completed or cancelled.'),
      ).toBeInTheDocument();
    });
  });

  it('hides all status-change buttons when the caller lacks Operations:projects:edit', () => {
    mockProject('in_progress');
    vi.spyOn(useProjectsModule, 'useUpdateProjectStatus').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(useProjectsModule, 'useAssignProjectManager').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
    });

    renderPage();
    expect(screen.queryByText(/Move to/)).not.toBeInTheDocument();
  });

  it('hides the Assign Project Manager section when the caller lacks Operations:projects:assign (distinct from :edit)', () => {
    mockProject('planning');
    vi.spyOn(useProjectsModule, 'useUpdateProjectStatus').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(useProjectsModule, 'useAssignProjectManager').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: (perm: string) => perm !== 'Operations:projects:assign',
      hasAnyPermission: () => true,
      hasAllPermissions: (perms: readonly string[]) => !perms.includes('Operations:projects:assign'),
    });

    renderPage();
    expect(screen.queryByText('Assign Project Manager')).not.toBeInTheDocument();
    // but status transitions (a different permission) are still visible
    expect(screen.getByText('Move to Approved')).toBeInTheDocument();
  });
});
