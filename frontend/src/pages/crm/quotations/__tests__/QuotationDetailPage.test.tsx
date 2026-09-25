import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { QuotationDetailPage } from '../QuotationDetailPage';
import * as useQuotationsModule from '../../../../api/queries/useQuotations';
import * as usePermissionsModule from '../../../../rbac/usePermissions';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * Covers the backend's draft-only item-mutation rule (422
 * otherwise) and that lifecycle action buttons only appear for
 * the transitions actually valid from the current status.
 */

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/crm/quotations/q-1']}>
          <Routes>
            <Route path="/crm/quotations/:id" element={<QuotationDetailPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

function mockQuotation(status: string, items: Array<{ id: string; description: string; quantity: string; unitPrice: string; total: string }> = []) {
  vi.spyOn(useQuotationsModule, 'useQuotation').mockReturnValue({
    data: {
      id: 'q-1',
      quotationNumber: 'QTN-2026-0001',
      status,
      subtotal: '0.00',
      discount: '0.00',
      tax: '0.00',
      total: '0.00',
      validUntil: null,
      items,
    },
    isLoading: false,
    error: null,
  } as any);
  vi.spyOn(useQuotationsModule, 'useSendQuotation').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.spyOn(useQuotationsModule, 'useAcceptQuotation').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.spyOn(useQuotationsModule, 'useRejectQuotation').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.spyOn(useQuotationsModule, 'useExpireQuotation').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.spyOn(useQuotationsModule, 'useAddQuotationItem').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  vi.spyOn(useQuotationsModule, 'useDeleteQuotationItem').mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
}

function allowAllPermissions() {
  vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
}

describe('QuotationDetailPage — draft-only item mutation gating', () => {
  it('shows the Add Item form and per-item Delete when status is draft', () => {
    mockQuotation('draft', [{ id: 'item-1', description: 'Consulting', quantity: '1', unitPrice: '500.00', total: '500.00' }]);
    allowAllPermissions();

    renderPage();
    expect(screen.getByText('Add Item')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides the Add Item form and per-item Delete once status is sent (backend rejects mutation with 422 otherwise)', () => {
    mockQuotation('sent', [{ id: 'item-1', description: 'Consulting', quantity: '1', unitPrice: '500.00', total: '500.00' }]);
    allowAllPermissions();

    renderPage();
    expect(screen.queryByText('Add Item')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    // The item itself is still visible/read-only
    expect(screen.getByText('Consulting')).toBeInTheDocument();
  });

  it('shows only the Send action for a draft quotation (draft -> sent is the only valid transition)', () => {
    mockQuotation('draft');
    allowAllPermissions();

    renderPage();
    expect(screen.getByText('Send')).toBeInTheDocument();
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('shows Accept/Reject/Mark Expired for a sent quotation, never Send again', () => {
    mockQuotation('sent');
    allowAllPermissions();

    renderPage();
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.getByText('Mark Expired')).toBeInTheDocument();
    expect(screen.queryByText('Send')).not.toBeInTheDocument();
  });

  it('shows no lifecycle actions at all for a terminal status (accepted)', () => {
    mockQuotation('accepted');
    allowAllPermissions();

    renderPage();
    expect(screen.queryByText('Send')).not.toBeInTheDocument();
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark Expired')).not.toBeInTheDocument();
  });

  it('hides the Send action when the caller lacks CRM:quotations:send, even on a draft quotation', () => {
    mockQuotation('draft');
    vi.spyOn(usePermissionsModule, 'usePermissions').mockReturnValue({
      hasPermission: (perm: string) => perm !== 'CRM:quotations:send',
      hasAnyPermission: () => true,
      hasAllPermissions: () => false,
    });

    renderPage();
    expect(screen.queryByText('Send')).not.toBeInTheDocument();
  });
});
