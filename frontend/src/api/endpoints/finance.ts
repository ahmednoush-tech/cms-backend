import { apiRequest } from '../client';
import type { PaginationMeta } from '../../types/api';
import type { Currency } from '../../types/entities/currency';
import type {
  Account,
  CreateAccountInput,
  UpdateAccountInput,
  AccountFilters,
  JournalEntry,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryFilters,
  FinanceSettings,
  UpdateFinanceSettingsInput,
  Invoice,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceFilters,
  Payment,
  CreatePaymentInput,
  Vendor,
  CreateVendorInput,
  UpdateVendorInput,
  VendorFilters,
  Bill,
  CreateBillInput,
  UpdateBillInput,
  BillFilters,
  BillPayment,
  CreateBillPaymentInput,
  TrialBalance,
  IncomeStatement,
  BalanceSheet,
  AccountingPeriod,
  CreatePeriodInput,
  InvoiceNote,
  CreateInvoiceNoteInput,
  CashFlowStatement,
  ZakatBaseEstimate,
  CustomerPayment,
  CreateCustomerPaymentInput,
  CustomerAgingReport,
  CustomerStatement,
  AccountLedger,
  InventoryItem,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  InventoryMovement,
  AdjustStockInput,
  InventoryItemFilters,
} from '../../types/entities/finance';

/** Confirmed 1:1 against backend/src/modules/finance/accounts.controller.ts. */
export const accountsApi = {
  list: async (filters: AccountFilters): Promise<{ items: Account[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<Account[]>({ method: 'GET', url: '/accounts', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<Account> => {
    const { data } = await apiRequest<Account>({ method: 'GET', url: `/accounts/${id}` });
    return data;
  },
  create: async (input: CreateAccountInput): Promise<Account> => {
    const { data } = await apiRequest<Account>({ method: 'POST', url: '/accounts', data: input });
    return data;
  },
  update: async (id: string, input: UpdateAccountInput): Promise<Account> => {
    const { data } = await apiRequest<Account>({ method: 'PATCH', url: `/accounts/${id}`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/accounts/${id}` });
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/journal-entries.controller.ts. */
export const journalEntriesApi = {
  list: async (filters: JournalEntryFilters): Promise<{ items: JournalEntry[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<JournalEntry[]>({ method: 'GET', url: '/journal-entries', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<JournalEntry> => {
    const { data } = await apiRequest<JournalEntry>({ method: 'GET', url: `/journal-entries/${id}` });
    return data;
  },
  create: async (input: CreateJournalEntryInput): Promise<JournalEntry> => {
    const { data } = await apiRequest<JournalEntry>({ method: 'POST', url: '/journal-entries', data: input });
    return data;
  },
  update: async (id: string, input: UpdateJournalEntryInput): Promise<JournalEntry> => {
    const { data } = await apiRequest<JournalEntry>({ method: 'PATCH', url: `/journal-entries/${id}`, data: input });
    return data;
  },
  post: async (id: string): Promise<JournalEntry> => {
    const { data } = await apiRequest<JournalEntry>({ method: 'POST', url: `/journal-entries/${id}/post` });
    return data;
  },
  void: async (id: string): Promise<JournalEntry> => {
    const { data } = await apiRequest<JournalEntry>({ method: 'POST', url: `/journal-entries/${id}/void` });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/journal-entries/${id}` });
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/finance-settings.controller.ts. */
export const financeSettingsApi = {
  get: async (): Promise<FinanceSettings> => {
    const { data } = await apiRequest<FinanceSettings>({ method: 'GET', url: '/finance-settings' });
    return data;
  },
  update: async (input: UpdateFinanceSettingsInput): Promise<FinanceSettings> => {
    const { data } = await apiRequest<FinanceSettings>({ method: 'PATCH', url: '/finance-settings', data: input });
    return data;
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/invoices.controller.ts. */
export const invoicesApi = {
  list: async (filters: InvoiceFilters): Promise<{ items: Invoice[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<Invoice[]>({ method: 'GET', url: '/invoices', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<Invoice> => {
    const { data } = await apiRequest<Invoice>({ method: 'GET', url: `/invoices/${id}` });
    return data;
  },
  create: async (input: CreateInvoiceInput): Promise<Invoice> => {
    const { data } = await apiRequest<Invoice>({ method: 'POST', url: '/invoices', data: input });
    return data;
  },
  update: async (id: string, input: UpdateInvoiceInput): Promise<Invoice> => {
    const { data } = await apiRequest<Invoice>({ method: 'PATCH', url: `/invoices/${id}`, data: input });
    return data;
  },
  issue: async (id: string): Promise<Invoice> => {
    const { data } = await apiRequest<Invoice>({ method: 'POST', url: `/invoices/${id}/issue` });
    return data;
  },
  cancel: async (id: string): Promise<Invoice> => {
    const { data } = await apiRequest<Invoice>({ method: 'POST', url: `/invoices/${id}/cancel` });
    return data;
  },
  getZatcaQrCode: async (id: string): Promise<string> => {
    const { data } = await apiRequest<{ qrCode: string }>({ method: 'GET', url: `/invoices/${id}/zatca-qr` });
    return data.qrCode;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/invoices/${id}` });
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/payments.controller.ts. */
export const paymentsApi = {
  listForInvoice: async (invoiceId: string): Promise<Payment[]> => {
    const { data } = await apiRequest<Payment[]>({ method: 'GET', url: '/payments', params: { invoiceId } });
    return data;
  },
  create: async (input: CreatePaymentInput): Promise<Payment> => {
    const { data } = await apiRequest<Payment>({ method: 'POST', url: '/payments', data: input });
    return data;
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/vendors.controller.ts. */
export const vendorsApi = {
  list: async (filters: VendorFilters): Promise<{ items: Vendor[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<Vendor[]>({ method: 'GET', url: '/vendors', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<Vendor> => {
    const { data } = await apiRequest<Vendor>({ method: 'GET', url: `/vendors/${id}` });
    return data;
  },
  create: async (input: CreateVendorInput): Promise<Vendor> => {
    const { data } = await apiRequest<Vendor>({ method: 'POST', url: '/vendors', data: input });
    return data;
  },
  update: async (id: string, input: UpdateVendorInput): Promise<Vendor> => {
    const { data } = await apiRequest<Vendor>({ method: 'PATCH', url: `/vendors/${id}`, data: input });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/vendors/${id}` });
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/bills.controller.ts. */
export const billsApi = {
  list: async (filters: BillFilters): Promise<{ items: Bill[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<Bill[]>({ method: 'GET', url: '/bills', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<Bill> => {
    const { data } = await apiRequest<Bill>({ method: 'GET', url: `/bills/${id}` });
    return data;
  },
  create: async (input: CreateBillInput): Promise<Bill> => {
    const { data } = await apiRequest<Bill>({ method: 'POST', url: '/bills', data: input });
    return data;
  },
  update: async (id: string, input: UpdateBillInput): Promise<Bill> => {
    const { data } = await apiRequest<Bill>({ method: 'PATCH', url: `/bills/${id}`, data: input });
    return data;
  },
  receive: async (id: string): Promise<Bill> => {
    const { data } = await apiRequest<Bill>({ method: 'POST', url: `/bills/${id}/receive` });
    return data;
  },
  cancel: async (id: string): Promise<Bill> => {
    const { data } = await apiRequest<Bill>({ method: 'POST', url: `/bills/${id}/cancel` });
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await apiRequest<void>({ method: 'DELETE', url: `/bills/${id}` });
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/bill-payments.controller.ts. */
export const billPaymentsApi = {
  listForBill: async (billId: string): Promise<BillPayment[]> => {
    const { data } = await apiRequest<BillPayment[]>({ method: 'GET', url: '/bill-payments', params: { billId } });
    return data;
  },
  create: async (input: CreateBillPaymentInput): Promise<BillPayment> => {
    const { data } = await apiRequest<BillPayment>({ method: 'POST', url: '/bill-payments', data: input });
    return data;
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/financial-reports.controller.ts. */
export const financialReportsApi = {
  trialBalance: async (asOfDate: string): Promise<TrialBalance> => {
    const { data } = await apiRequest<TrialBalance>({ method: 'GET', url: '/finance-reports/trial-balance', params: { asOfDate } });
    return data;
  },
  incomeStatement: async (fromDate: string, toDate: string): Promise<IncomeStatement> => {
    const { data } = await apiRequest<IncomeStatement>({ method: 'GET', url: '/finance-reports/income-statement', params: { fromDate, toDate } });
    return data;
  },
  balanceSheet: async (asOfDate: string): Promise<BalanceSheet> => {
    const { data } = await apiRequest<BalanceSheet>({ method: 'GET', url: '/finance-reports/balance-sheet', params: { asOfDate } });
    return data;
  },
  cashFlow: async (fromDate: string, toDate: string): Promise<CashFlowStatement> => {
    const { data } = await apiRequest<CashFlowStatement>({ method: 'GET', url: '/finance-reports/cash-flow', params: { fromDate, toDate } });
    return data;
  },
  zakatBaseEstimate: async (asOfDate: string): Promise<ZakatBaseEstimate> => {
    const { data } = await apiRequest<ZakatBaseEstimate>({ method: 'GET', url: '/finance-reports/zakat-base-estimate', params: { asOfDate } });
    return data;
  },
  customerAging: async (asOfDate: string): Promise<CustomerAgingReport> => {
    const { data } = await apiRequest<CustomerAgingReport>({ method: 'GET', url: '/finance-reports/customer-aging', params: { asOfDate } });
    return data;
  },
  customerStatement: async (customerId: string, fromDate: string, toDate: string): Promise<CustomerStatement> => {
    const { data } = await apiRequest<CustomerStatement>({ method: 'GET', url: '/finance-reports/customer-statement', params: { customerId, fromDate, toDate } });
    return data;
  },
  accountLedger: async (accountId: string, fromDate: string, toDate: string): Promise<AccountLedger> => {
    const { data } = await apiRequest<AccountLedger>({ method: 'GET', url: '/finance-reports/account-ledger', params: { accountId, fromDate, toDate } });
    return data;
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/periods.controller.ts. */
export const periodsApi = {
  list: async (): Promise<AccountingPeriod[]> => {
    const { data } = await apiRequest<AccountingPeriod[]>({ method: 'GET', url: '/accounting-periods' });
    return data;
  },
  get: async (id: string): Promise<AccountingPeriod> => {
    const { data } = await apiRequest<AccountingPeriod>({ method: 'GET', url: `/accounting-periods/${id}` });
    return data;
  },
  create: async (input: CreatePeriodInput): Promise<AccountingPeriod> => {
    const { data } = await apiRequest<AccountingPeriod>({ method: 'POST', url: '/accounting-periods', data: input });
    return data;
  },
  lock: async (id: string): Promise<AccountingPeriod> => {
    const { data } = await apiRequest<AccountingPeriod>({ method: 'POST', url: `/accounting-periods/${id}/lock` });
    return data;
  },
  unlock: async (id: string): Promise<AccountingPeriod> => {
    const { data } = await apiRequest<AccountingPeriod>({ method: 'POST', url: `/accounting-periods/${id}/unlock` });
    return data;
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/invoice-notes.controller.ts. */
export const invoiceNotesApi = {
  listForInvoice: async (invoiceId: string): Promise<InvoiceNote[]> => {
    const { data } = await apiRequest<InvoiceNote[]>({ method: 'GET', url: '/invoice-notes', params: { invoiceId } });
    return data;
  },
  get: async (id: string): Promise<InvoiceNote> => {
    const { data } = await apiRequest<InvoiceNote>({ method: 'GET', url: `/invoice-notes/${id}` });
    return data;
  },
  create: async (input: CreateInvoiceNoteInput): Promise<InvoiceNote> => {
    const { data } = await apiRequest<InvoiceNote>({ method: 'POST', url: '/invoice-notes', data: input });
    return data;
  },
  issue: async (id: string): Promise<InvoiceNote> => {
    const { data } = await apiRequest<InvoiceNote>({ method: 'POST', url: `/invoice-notes/${id}/issue` });
    return data;
  },
  cancel: async (id: string): Promise<InvoiceNote> => {
    const { data } = await apiRequest<InvoiceNote>({ method: 'POST', url: `/invoice-notes/${id}/cancel` });
    return data;
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/customer-payments.controller.ts. */
export const customerPaymentsApi = {
  list: async (customerId?: string): Promise<CustomerPayment[]> => {
    const { data } = await apiRequest<CustomerPayment[]>({ method: 'GET', url: '/customer-payments', params: customerId ? { customerId } : undefined });
    return data;
  },
  get: async (id: string): Promise<CustomerPayment> => {
    const { data } = await apiRequest<CustomerPayment>({ method: 'GET', url: `/customer-payments/${id}` });
    return data;
  },
  create: async (input: CreateCustomerPaymentInput): Promise<CustomerPayment> => {
    const { data } = await apiRequest<CustomerPayment>({ method: 'POST', url: '/customer-payments', data: input });
    return data;
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/inventory-items.controller.ts. */
export const inventoryItemsApi = {
  list: async (filters: InventoryItemFilters): Promise<{ items: InventoryItem[]; meta: PaginationMeta }> => {
    const { data, meta } = await apiRequest<InventoryItem[]>({ method: 'GET', url: '/inventory-items', params: filters });
    return { items: data, meta: meta as unknown as PaginationMeta };
  },
  get: async (id: string): Promise<InventoryItem> => {
    const { data } = await apiRequest<InventoryItem>({ method: 'GET', url: `/inventory-items/${id}` });
    return data;
  },
  create: async (input: CreateInventoryItemInput): Promise<InventoryItem> => {
    const { data } = await apiRequest<InventoryItem>({ method: 'POST', url: '/inventory-items', data: input });
    return data;
  },
  update: async (id: string, input: UpdateInventoryItemInput): Promise<InventoryItem> => {
    const { data } = await apiRequest<InventoryItem>({ method: 'PATCH', url: `/inventory-items/${id}`, data: input });
    return data;
  },
  listMovements: async (id: string): Promise<InventoryMovement[]> => {
    const { data } = await apiRequest<InventoryMovement[]>({ method: 'GET', url: `/inventory-items/${id}/movements` });
    return data;
  },
  adjustStock: async (input: AdjustStockInput): Promise<InventoryItem> => {
    const { data } = await apiRequest<InventoryItem>({ method: 'POST', url: '/inventory-items/adjust-stock', data: input });
    return data;
  },
};

/** Confirmed 1:1 against backend/src/modules/finance/currencies.controller.ts. Small, rarely-changing reference list — safe to cache for a while on the frontend. */
export const currenciesApi = {
  list: async (): Promise<Currency[]> => {
    const { data } = await apiRequest<Currency[]>({ method: 'GET', url: '/currencies' });
    return data;
  },
};
