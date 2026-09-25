// ============================================================
// Customer Portal — read-only, customer-scoped views. These are
// DELIBERATELY narrower than the internal Invoice/Quotation/
// Project types (types/entities/finance.ts, crm.ts, operations.ts)
// — they mirror the backend's explicit `select()` in
// PortalService exactly, so a field the customer isn't meant to
// see (e.g. internal notes, journal entry IDs) can never
// accidentally appear here even if the internal type gains one.
// ============================================================

export interface PortalQuotationItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  total: string;
}

export interface PortalQuotation {
  id: string;
  quotationNumber: string;
  status: 'sent' | 'accepted' | 'rejected' | 'expired';
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  validUntil: string | null;
  createdAt: string;
}

export interface PortalQuotationDetail extends PortalQuotation {
  items: PortalQuotationItem[];
}

export interface PortalInvoiceItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  total: string;
}

export interface PortalInvoicePayment {
  id: string;
  amount: string;
  paymentDate: string;
  method: string;
}

export interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  status: 'sent' | 'partially_paid' | 'paid' | 'overdue';
  issueDate: string;
  dueDate: string | null;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  amountPaid: string;
}

export interface PortalInvoiceDetail extends PortalInvoice {
  items: PortalInvoiceItem[];
  payments: PortalInvoicePayment[];
}

export interface PortalProject {
  id: string;
  projectNumber: string;
  name: string;
  description: string | null;
  status: 'planning' | 'approved' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  startDate: string | null;
  endDate: string | null;
}
