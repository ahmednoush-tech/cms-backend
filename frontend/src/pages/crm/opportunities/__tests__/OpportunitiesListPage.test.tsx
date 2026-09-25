import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/testUtils';
import { OpportunitiesListPage } from '../OpportunitiesListPage';
import * as useOpportunitiesModule from '../../../../api/queries/useOpportunities';
import { PERMISSIONS } from '../../../../rbac/permissionConstants';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Confirms the CRM module renders correctly with Arabic active —
 * translated headers/labels, no raw backend enum values leaking
 * through (same "do not translate database values blindly" rule
 * from Phase 3A/3B, applied here to a new module).
 *
 * Phase 3F fix: uses the shared renderWithProviders (real
 * AuthContext + MemoryRouter) — this file's "New Opportunity"
 * button is behind a real PermissionGate, which crashed with no
 * AuthContext present.
 */

async function renderWithArabic() {
  return renderWithProviders(<OpportunitiesListPage />, {
    route: '/crm/opportunities',
    language: 'ar',
    permissions: [PERMISSIONS.CRM.opportunities.view],
  });
}

describe('OpportunitiesListPage — Arabic / RTL rendering', () => {
  it('renders the page title and empty state in Arabic', async () => {
    vi.spyOn(useOpportunitiesModule, 'useOpportunities').mockReturnValue({
      data: { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useOpportunitiesModule, 'useCreateOpportunity').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    await renderWithArabic();
    expect(screen.getByText('الفرص')).toBeInTheDocument();
    expect(screen.getByText('لا توجد فرص بعد')).toBeInTheDocument();
  });

  it('translates the stage badge rather than showing the raw backend value', async () => {
    vi.spyOn(useOpportunitiesModule, 'useOpportunities').mockReturnValue({
      data: {
        items: [
          {
            id: 'opp-1',
            name: 'صفقة كبيرة',
            stage: 'negotiation',
            value: '10000.00',
            currency: 'SAR',
            probability: 60,
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    } as any);
    vi.spyOn(useOpportunitiesModule, 'useCreateOpportunity').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);

    await renderWithArabic();
    expect(screen.queryByText('negotiation')).not.toBeInTheDocument();
    // Scoped to the table specifically — the Stage FilterBar dropdown
    // legitimately has its own "تفاوض" (negotiation) <option>, so an
    // unscoped getByText would (correctly) find two matches and fail
    // with "multiple elements found." The badge is what this test is
    // actually about.
    expect(within(screen.getByRole('table')).getByText('تفاوض')).toBeInTheDocument();
  });
});
