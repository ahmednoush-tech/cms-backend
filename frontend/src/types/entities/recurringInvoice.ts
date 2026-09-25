export type RecurringInvoiceFrequency = 'monthly' | 'quarterly' | 'yearly';
export type RecurringInvoiceStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface RecurringInvoiceTemplateItem {
  id: string;
  templateId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
}

export interface RecurringInvoiceTemplate {
  id: string;
  companyId: string;
  customerId: string;
  name: string;
  currencyCode: string;
  exchangeRateToBase: string;
  frequency: RecurringInvoiceFrequency;
  startDate: string;
  nextGenerationDate: string;
  endDate: string | null;
  status: RecurringInvoiceStatus;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items?: RecurringInvoiceTemplateItem[];
  customer?: { id: string; companyName: string | null; customerCode: string };
  generatedInvoices?: Array<{ id: string; invoiceNumber: string; issueDate: string; total: string; status: string }>;
}

export interface CreateRecurringInvoiceTemplateItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
}

export interface CreateRecurringInvoiceTemplateInput {
  customerId: string;
  name: string;
  frequency: RecurringInvoiceFrequency;
  startDate: string;
  endDate?: string;
  currencyCode?: string;
  exchangeRateToBase?: number;
  notes?: string;
  items: CreateRecurringInvoiceTemplateItemInput[];
}

export interface UpdateRecurringInvoiceTemplateInput {
  name?: string;
  endDate?: string;
  notes?: string;
  items?: CreateRecurringInvoiceTemplateItemInput[];
}

export interface GenerateDueResult {
  generatedCount: number;
  generated: Array<{ templateName: string; invoiceId: string; invoiceNumber: string }>;
  skipped: string[];
}
