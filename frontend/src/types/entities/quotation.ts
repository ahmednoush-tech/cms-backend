import type { Customer } from './customer';

export interface QuotationItem {
  id: string;
  quotationId: string;
  description: string;
  /** All monetary/quantity fields are Prisma Decimal -> strings, confirmed this session. */
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  total: string;
  /** Catalog reference only — a quotation never creates a stock movement. */
  stockItemId: string | null;
}

export interface Quotation {
  id: string;
  companyId: string;
  customerId: string;
  opportunityId: string | null;
  quotationNumber: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  currencyCode: string;
  exchangeRateToBase: string;
  validUntil: string | null;
  createdBy: string | null;
  publicToken: string;
  createdAt: string;
  updatedAt: string;
  items?: QuotationItem[];
  /**
   * Confirmed this session — GET /quotations/:id's actual Prisma
   * query already does `include: { items, customer: true,
   * opportunity: true }`. This field was always present on the
   * real API response; the frontend type just never modeled it
   * until the PDF-export feature needed the customer's name/
   * address for the "Bill To" section. No backend change was
   * needed for this.
   */
  customer?: Customer;
}

export interface CreateQuotationInput {
  customerId: string;
  opportunityId?: string;
  validUntil?: string;
  currencyCode?: string;
  exchangeRateToBase?: number;
}

export interface UpdateQuotationInput {
  customerId?: string;
  opportunityId?: string;
  validUntil?: string;
}

export interface CreateQuotationItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  stockItemId?: string;
}

export type UpdateQuotationItemInput = Partial<CreateQuotationItemInput>;

export interface QuotationFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  customerId?: string;
  opportunityId?: string;
  status?: string;
}
