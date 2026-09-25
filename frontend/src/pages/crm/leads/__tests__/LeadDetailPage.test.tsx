import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { LeadDetailPage } from '../LeadDetailPage';
import * as useLeadsModule from '../../../../api/queries/useLeads';
import * as usePermissionsModule from '../../../../rbac/usePermissions';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Covers the lead-conversion dual-permission requirement
 * specifically (CRM:leads:edit AND CRM:customers:create), and
 * that the Convert action only appears from an eligible status.
 */

function renderPage(leadId = 'lead-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[`/crm/leads/${leadId}`]}>
          <Routes>
            <Route path="/crm/leads/:id" element={<LeadDetailPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

function mockLead(overrides: Partial<{ status: string; convertedAt: string | null }> = {}) {
  vi.spyOn(useLeadsModule, 'useLead').mockReturnValue({
    data: {
      id: 'lead-1',
      name: 'Jane Prospect',
      companyName: 'Prospect Co',
      email: null,
      phone: null,
      source: null,
      notes: null,
      status: 'qualified',
      convertedAt: null,
      ...overrides,
    },
    isLoading: false,
    error: null,
  } as any);
  vi.spyOn(useLeadsModule, 'useUpdateLeadStatus').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.spyOn(useLeadsModule, 'useConvertLead').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
}

describe('LeadDetailPage — conversion and status transitions', () => {
  it('shows the Convert button when the lead is eligible (qualified) AND the caller has both required permissions', () => {
    mockLead({ status: 'qualified' });
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: (perms: readonly string[]) => perms.includes('CRM:leads:edit') && perms.includes('CRM:customers:create'),
    });

    renderPage();
    expect(screen.getByText('Convert to Customer')).toBeInTheDocument();
  });

  it('hides the Convert button when the caller has only ONE of the two required permissions', () => {
    mockLead({ status: 'qualified' });
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => false, // has leads:edit but not customers:create, or vice versa
    });

    renderPage();
    expect(screen.queryByText('Convert to Customer')).not.toBeInTheDocument();
  });

  it('hides the Convert button for a non-eligible status (new)', () => {
    mockLead({ status: 'new' });
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
    });

    renderPage();
    expect(screen.queryByText('Convert to Customer')).not.toBeInTheDocument();
  });

  it('hides the Convert button when the lead is already converted, even if otherwise eligible', () => {
    mockLead({ status: 'won', convertedAt: '2026-01-01T00:00:00Z' });
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
    });

    renderPage();
    expect(screen.queryByText('Convert to Customer')).not.toBeInTheDocument();
    expect(screen.getByText('This lead has already been converted')).toBeInTheDocument();
  });

  it('only offers the transitions valid from the current status (qualified -> proposal/lost, never -> won directly)', () => {
    mockLead({ status: 'qualified' });
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: () => true,
      hasAnyPermission: () => true,
      // This test isn't about the Convert button at all — it needs
      // CRM:leads:edit to be granted so the (unrelated) single-
      // permission PermissionGate around the status-transition
      // buttons doesn't hide them. `false` here previously hid
      // every transition button, not just gated conversion.
      hasAllPermissions: () => true,
    });

    renderPage();
    expect(screen.getByText('Move to Proposal')).toBeInTheDocument();
    expect(screen.getByText('Move to Lost')).toBeInTheDocument();
    expect(screen.queryByText('Move to Won')).not.toBeInTheDocument();
  });
});
