import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { generateQuotationPdf } from '../generateQuotationPdf';
import type { Quotation } from '../../types/entities/quotation';
import type { CompanyInfo } from '../../types/entities/companySettings';

/**
 * NOT EXECUTED in this environment — see src/test/setup.ts.
 * jsPDF's real `.save()` uses `URL.createObjectURL`, which jsdom
 * does not implement — mocked here so these tests isolate what
 * they're actually meant to verify (that BUILDING the document —
 * every .text()/.autoTable() call — survives null/undefined
 * fields without throwing), not the browser download mechanism
 * itself, which is untestable in jsdom regardless of this file's
 * own code.
 */
vi.spyOn(jsPDF.prototype, 'save').mockImplementation(() => jsPDF.prototype as never);

function buildQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: 'q-1',
    companyId: 'company-1',
    customerId: 'cust-1',
    opportunityId: null,
    quotationNumber: 'QTN-2026-0001',
    status: 'sent',
    subtotal: '1000.00',
    discount: '50.00',
    tax: '95.00',
    total: '1045.00',
    currencyCode: 'SAR',
    exchangeRateToBase: '1.00',
    validUntil: '2026-12-31',
    createdBy: null,
    publicToken: 'a1b2c3d4-token',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    items: [
      { id: 'item-1', quotationId: 'q-1', description: 'Consulting', quantity: '2', unitPrice: '500.00', discount: '50.00', tax: '95.00', total: '1045.00', stockItemId: null },
    ],
    customer: {
      id: 'cust-1',
      companyId: 'company-1',
      customerType: 'company',
      companyName: 'Acme Trading',
      customerCode: 'CUST-0001',
      email: 'contact@acme.example',
      phone: '+966500000000',
      website: null,
      address: '123 Business Bay',
      city: 'Riyadh',
      country: 'Saudi Arabia',
      vatRegistrationNumber: null,
      status: 'active',
      ownerId: null,
      customFields: {},
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    ...overrides,
  };
}

function buildCompany(overrides: Partial<CompanyInfo> = {}): CompanyInfo {
  return {
    id: 'company-1',
    name: 'Acme Co',
    legalName: 'Acme Trading Co. Ltd.',
    email: 'info@acme.example',
    phone: '+966500000001',
    website: null,
    logo: null,
    address: '456 Corporate Blvd',
    city: 'Riyadh',
    country: 'Saudi Arabia',
    taxNumber: '300000000000003',
    status: 'active',
    ...overrides,
  };
}

describe('generateQuotationPdf', () => {
  it('builds and saves a PDF for a fully-populated quotation without throwing', () => {
    const quotation = buildQuotation();
    expect(() => generateQuotationPdf(quotation, buildCompany())).not.toThrow();
  });

  it('does not throw when the customer is missing (defensive — should not happen given the real API always includes it)', () => {
    const quotation = buildQuotation({ customer: undefined });
    expect(() => generateQuotationPdf(quotation, buildCompany())).not.toThrow();
  });

  it('does not throw for a quotation with zero line items (draft, nothing added yet)', () => {
    const quotation = buildQuotation({ items: [] });
    expect(() => generateQuotationPdf(quotation, buildCompany())).not.toThrow();
  });

  it('does not throw when validUntil is null', () => {
    const quotation = buildQuotation({ validUntil: null });
    expect(() => generateQuotationPdf(quotation, buildCompany())).not.toThrow();
  });
});
