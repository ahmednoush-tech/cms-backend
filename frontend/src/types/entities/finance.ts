import type { Customer } from './customer';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export type CashFlowCategory = 'operating' | 'investing' | 'financing';
export type ZakatCategory = 'long_term_liability' | 'fixed_asset' | 'long_term_investment';

export interface Account {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  cashFlowCategory: CashFlowCategory | null;
  zakatCategory: ZakatCategory | null;
  parentId: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present only on GET /accounts/:id (findOne includes them) — never on the list. */
  parent?: Account | null;
  children?: Account[];
}

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  cashFlowCategory?: CashFlowCategory;
  zakatCategory?: ZakatCategory;
  parentId?: string;
  description?: string;
}

/**
 * Deliberately narrower than CreateAccountInput — matches the
 * backend's actual UpdateAccountDto exactly. code/type/
 * normalBalance/parentId are NOT editable after creation (the
 * backend's own comment: changing these after journal entries
 * have posted against the account would silently corrupt
 * historical reports). Deactivate and recreate instead.
 */
export interface UpdateAccountInput {
  name?: string;
  cashFlowCategory?: CashFlowCategory;
  zakatCategory?: ZakatCategory;
  description?: string;
  isActive?: boolean;
}

export interface AccountFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  type?: AccountType;
}

export type JournalEntryStatus = 'draft' | 'posted' | 'void';

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  /** Decimal columns — always strings, same rule as Quotation money fields. */
  debit: string;
  credit: string;
  description: string | null;
  lineOrder: number;
  /** Present only on GET /journal-entries/:id (findOne includes it). */
  account?: Account;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  entryNumber: string;
  entryDate: string;
  reference: string | null;
  description: string | null;
  status: JournalEntryStatus;
  createdBy: string | null;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: JournalEntryLine[];
}

export interface JournalEntryLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
}

export interface CreateJournalEntryInput {
  entryDate: string;
  reference?: string;
  description?: string;
  lines: JournalEntryLineInput[];
}

/** Providing `lines` replaces the entry's entire line set — only reachable while status is 'draft'. */
export interface UpdateJournalEntryInput {
  entryDate?: string;
  reference?: string;
  description?: string;
  lines?: JournalEntryLineInput[];
}

export interface JournalEntryFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  status?: JournalEntryStatus;
}

// ============================================================
// Finance F2 — Invoicing + Payments
// ============================================================

export interface FinanceSettings {
  companyId: string;
  defaultReceivableAccountId: string | null;
  defaultRevenueAccountId: string | null;
  defaultTaxPayableAccountId: string | null;
  defaultCashAccountId: string | null;
  defaultPayableAccountId: string | null;
  defaultExpenseAccountId: string | null;
  defaultTaxRecoverableAccountId: string | null;
  defaultAssetDisposalGainLossAccountId: string | null;
  /** ZATCA Phase 1 QR fields — the legal seller name and 15-digit VAT registration number. */
  sellerName: string | null;
  vatRegistrationNumber: string | null;
  sellerStreetName: string | null;
  sellerBuildingNumber: string | null;
  sellerDistrict: string | null;
  sellerCity: string | null;
  sellerPostalCode: string | null;
  lastZatcaIcv: number;
  updatedAt: string | null;
}

export interface UpdateFinanceSettingsInput {
  defaultReceivableAccountId?: string;
  defaultRevenueAccountId?: string;
  defaultTaxPayableAccountId?: string;
  defaultCashAccountId?: string;
  defaultPayableAccountId?: string;
  defaultExpenseAccountId?: string;
  defaultTaxRecoverableAccountId?: string;
  defaultAssetDisposalGainLossAccountId?: string;
  sellerName?: string;
  vatRegistrationNumber?: string;
  sellerStreetName?: string;
  sellerBuildingNumber?: string;
  sellerDistrict?: string;
  sellerCity?: string;
  sellerPostalCode?: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'cheque' | 'other';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  total: string;
  inventoryItemId: string | null;
}

export interface Payment {
  id: string;
  companyId: string;
  invoiceId: string;
  amount: string;
  exchangeRateToBase: string;
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  journalEntryId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  companyId: string;
  customerId: string;
  quotationId: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: InvoiceStatus;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  amountPaid: string;
  currencyCode: string;
  exchangeRateToBase: string;
  notes: string | null;
  journalEntryId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present only on GET /invoices/:id (findOne includes them). */
  items?: InvoiceItem[];
  customer?: Customer;
  payments?: Payment[];
}

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  inventoryItemId?: string;
}

/**
 * Two shapes in one, matching the backend's own CreateInvoiceDto
 * exactly: provide `quotationId` alone to invoice an accepted
 * quotation (customer/items are copied server-side), or provide
 * `customerId` + `items` to create a standalone invoice.
 */
export interface CreateInvoiceInput {
  quotationId?: string;
  customerId?: string;
  issueDate: string;
  dueDate?: string;
  notes?: string;
  items?: InvoiceItemInput[];
  currencyCode?: string;
  exchangeRateToBase?: number;
  warehouseId?: string;
}

export interface UpdateInvoiceInput {
  dueDate?: string;
  notes?: string;
}

export interface InvoiceFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  status?: InvoiceStatus;
  customerId?: string;
}

export interface CreatePaymentInput {
  invoiceId: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  reference?: string;
  exchangeRateToBase?: number;
}

// ============================================================
// Finance F4 — Expenses / Accounts Payable (mirror of F2)
// ============================================================

export type VendorStatus = 'active' | 'inactive';

export interface Vendor {
  id: string;
  companyId: string;
  vendorCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  status: VendorStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorInput {
  vendorCode: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface UpdateVendorInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  status?: VendorStatus;
}

export interface VendorFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  status?: VendorStatus;
}

export type BillStatus = 'draft' | 'received' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface BillItem {
  id: string;
  billId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  total: string;
  inventoryItemId: string | null;
}

export interface BillPayment {
  id: string;
  companyId: string;
  billId: string;
  amount: string;
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  journalEntryId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface Bill {
  id: string;
  companyId: string;
  vendorId: string;
  billNumber: string;
  vendorReference: string | null;
  billDate: string;
  dueDate: string | null;
  status: BillStatus;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  amountPaid: string;
  notes: string | null;
  journalEntryId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items?: BillItem[];
  vendor?: Vendor;
  payments?: BillPayment[];
  projectId: string | null;
  project?: { id: string; name: string } | null;
}

export interface BillItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  inventoryItemId?: string;
}

export interface CreateBillInput {
  vendorId: string;
  vendorReference?: string;
  billDate: string;
  dueDate?: string;
  notes?: string;
  projectId?: string;
  items: BillItemInput[];
}

export interface UpdateBillInput {
  vendorReference?: string;
  dueDate?: string;
  notes?: string;
  /** Send null to unlink this bill from any project — see backend UpdateBillDto. */
  projectId?: string | null;
}

export interface BillFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  status?: BillStatus;
  vendorId?: string;
}

export interface CreateBillPaymentInput {
  billId: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  reference?: string;
}

// ============================================================
// Finance F5 — Financial Statements (read-only reports, no new
// tables — pure aggregation over F1's journal entry data)
// ============================================================

export interface TrialBalanceLine {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debit: string;
  credit: string;
}

export interface TrialBalance {
  asOfDate: string;
  lines: TrialBalanceLine[];
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
}

export interface IncomeStatementLine {
  accountId: string;
  code: string;
  name: string;
  amount: string;
}

export interface IncomeStatement {
  fromDate: string;
  toDate: string;
  revenueLines: IncomeStatementLine[];
  expenseLines: IncomeStatementLine[];
  totalRevenue: string;
  totalExpense: string;
  netIncome: string;
}

export interface BalanceSheetLine {
  accountId: string;
  code: string;
  name: string;
  balance: string;
}

export interface BalanceSheetSection {
  lines: BalanceSheetLine[];
  total: string;
}

/**
 * `unclosedNetIncome` and the fact `isBalanced` accounts for it —
 * this system does not yet close revenue/expense into Retained
 * Earnings at period-end (a deliberate, disclosed gap, not a bug —
 * see FinancialReportsService.balanceSheet() on the backend). The
 * UI must show this figure plainly, never hide it, so a viewer
 * understands why Assets might not equal Liabilities + Equity on
 * their own without it.
 */
export interface BalanceSheet {
  asOfDate: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  unclosedNetIncome: string;
  isBalanced: boolean;
}

// ============================================================
// Finance F6 — Accounting Periods (period locking)
// ============================================================

export type PeriodStatus = 'open' | 'locked';

export interface AccountingPeriod {
  id: string;
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  lockedAt: string | null;
  lockedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePeriodInput {
  name: string;
  startDate: string;
  endDate: string;
}

// ============================================================
// Finance F8 — Credit/Debit Notes against Invoices
// ============================================================

export type InvoiceNoteType = 'credit' | 'debit';
export type InvoiceNoteStatus = 'draft' | 'issued' | 'cancelled';

export interface InvoiceNoteItem {
  id: string;
  noteId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  total: string;
}

export interface InvoiceNote {
  id: string;
  companyId: string;
  invoiceId: string;
  noteType: InvoiceNoteType;
  noteNumber: string;
  noteDate: string;
  reason: string | null;
  status: InvoiceNoteStatus;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  journalEntryId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items?: InvoiceNoteItem[];
}

export interface InvoiceNoteItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
}

export interface CreateInvoiceNoteInput {
  invoiceId: string;
  noteType: InvoiceNoteType;
  noteDate: string;
  reason?: string;
  items: InvoiceNoteItemInput[];
}

// ============================================================
// Finance F9 — Cash Flow Statement
// ============================================================

export interface CashFlowLine {
  journalEntryId: string;
  entryDate: string;
  description: string | null;
  counterpartyAccountName: string | null;
  amount: string;
}

export interface CashFlowSection {
  lines: CashFlowLine[];
  total: string;
}

/**
 * Scoped to the single default Cash account in Finance Settings —
 * a company with multiple bank/cash accounts only sees the one
 * designated as default here (see backend
 * FinancialReportsService.cashFlow() for the full disclosed
 * limitation).
 */
export interface CashFlowStatement {
  fromDate: string;
  toDate: string;
  beginningBalance: string;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  uncategorized: CashFlowSection;
  netChange: string;
  endingBalance: string;
}

// ============================================================
// Finance F10 — Zakat Base ESTIMATE (not a Zakat return
// calculator — see backend FinancialReportsService.
// zakatBaseEstimate() for the full disclosed rationale: this
// system has no shareholder-ownership data model, and real Zakat
// filing needs a qualified advisor's review).
// ============================================================

export interface ZakatBaseEstimate {
  asOfDate: string;
  totalEquity: string;
  longTermLiabilities: BalanceSheetSection;
  fixedAssets: BalanceSheetSection;
  longTermInvestments: BalanceSheetSection;
  zakatBaseEstimate: string;
  estimatedZakatDueHijriRate: string;
  estimatedZakatDueGregorianRate: string;
}

// ============================================================
// Finance F11 — Customer Payment Allocation
// ============================================================

export interface PaymentAllocationInput {
  invoiceId: string;
  amount: number;
}

export interface CreateCustomerPaymentInput {
  customerId: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  reference?: string;
  allocations: PaymentAllocationInput[];
}

/** A Payment created via a CustomerPayment carries invoice.invoiceNumber for display. */
export interface CustomerPaymentAllocationRecord extends Payment {
  invoice: { invoiceNumber: string };
}

export interface CustomerPayment {
  id: string;
  companyId: string;
  customerId: string;
  amount: string;
  unappliedAmount: string;
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  createdBy: string | null;
  createdAt: string;
  payments?: CustomerPaymentAllocationRecord[];
  customer?: Customer;
}

// ============================================================
// Finance F12 — Customer Aging Report + Customer Statement
// ============================================================

export interface AgingBucketAmounts {
  current: string;
  days1to30: string;
  days31to60: string;
  days61to90: string;
  over90: string;
  noDueDate: string;
  total: string;
}

export interface CustomerAgingRow extends AgingBucketAmounts {
  customerId: string;
  customerName: string;
}

export interface CustomerAgingReport {
  asOfDate: string;
  rows: CustomerAgingRow[];
  grandTotal: AgingBucketAmounts;
}

export type StatementLineType = 'invoice' | 'payment' | 'credit_note' | 'debit_note';

export interface StatementLine {
  date: string;
  type: StatementLineType;
  reference: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface CustomerStatement {
  customerId: string;
  customerName: string;
  fromDate: string;
  toDate: string;
  openingBalance: string;
  lines: StatementLine[];
  closingBalance: string;
}

// ============================================================
// Finance F13 — General Ledger (per-account detail)
// ============================================================

export interface LedgerLine {
  date: string;
  entryNumber: string;
  reference: string | null;
  description: string | null;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface AccountLedger {
  accountId: string;
  accountCode: string;
  accountName: string;
  fromDate: string;
  toDate: string;
  openingBalance: string;
  lines: LedgerLine[];
  closingBalance: string;
}

// ============================================================
// Finance F14/F15 — Inventory + COGS integration
// ============================================================

export interface InventoryItem {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string | null;
  unitOfMeasure: string;
  quantityOnHand: string;
  averageUnitCost: string;
  inventoryAccountId: string | null;
  cogsAccountId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryItemInput {
  sku: string;
  name: string;
  description?: string;
  unitOfMeasure?: string;
  openingQuantity?: number;
  openingUnitCost?: number;
  inventoryAccountId?: string;
  cogsAccountId?: string;
}

export interface UpdateInventoryItemInput {
  name?: string;
  description?: string;
  unitOfMeasure?: string;
  inventoryAccountId?: string;
  cogsAccountId?: string;
  isActive?: boolean;
}

export type InventoryMovementType = 'purchase' | 'sale' | 'adjustment_increase' | 'adjustment_decrease';

export interface InventoryMovement {
  id: string;
  companyId: string;
  inventoryItemId: string;
  movementType: InventoryMovementType;
  quantity: string;
  unitCost: string;
  quantityAfter: string;
  averageCostAfter: string;
  reference: string | null;
  notes: string | null;
  journalEntryId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface AdjustStockInput {
  inventoryItemId: string;
  direction: 'increase' | 'decrease';
  quantity: number;
  unitCost?: number;
  offsetAccountId: string;
  notes?: string;
}

export interface InventoryItemFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  isActive?: boolean;
}
