import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountsApi, journalEntriesApi, financeSettingsApi, invoicesApi, paymentsApi, vendorsApi, billsApi, billPaymentsApi, financialReportsApi, periodsApi, invoiceNotesApi, customerPaymentsApi, inventoryItemsApi, currenciesApi } from '../endpoints/finance';
import type {
  AccountFilters,
  CreateAccountInput,
  UpdateAccountInput,
  JournalEntryFilters,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  UpdateFinanceSettingsInput,
  InvoiceFilters,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  CreatePaymentInput,
  VendorFilters,
  CreateVendorInput,
  UpdateVendorInput,
  BillFilters,
  CreateBillInput,
  UpdateBillInput,
  CreateBillPaymentInput,
  CreatePeriodInput,
  CreateInvoiceNoteInput,
  CreateCustomerPaymentInput,
  InventoryItemFilters,
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
  AdjustStockInput,
} from '../../types/entities/finance';

export function useAccounts(filters: AccountFilters) {
  return useQuery({ queryKey: ['accounts', 'list', filters], queryFn: () => accountsApi.list(filters) });
}

export function useAccount(id: string | undefined) {
  return useQuery({ queryKey: ['accounts', 'detail', id], queryFn: () => accountsApi.get(id!), enabled: !!id });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) => accountsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts', 'list'] }),
  });
}

export function useUpdateAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAccountInput) => accountsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['accounts', 'list'] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts', 'list'] }),
  });
}

// ---- Journal Entries ----

export function useJournalEntries(filters: JournalEntryFilters) {
  return useQuery({ queryKey: ['journalEntries', 'list', filters], queryFn: () => journalEntriesApi.list(filters) });
}

export function useJournalEntry(id: string | undefined) {
  return useQuery({ queryKey: ['journalEntries', 'detail', id], queryFn: () => journalEntriesApi.get(id!), enabled: !!id });
}

function invalidateJournalEntry(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['journalEntries', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['journalEntries', 'list'] });
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJournalEntryInput) => journalEntriesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['journalEntries', 'list'] }),
  });
}

export function useUpdateJournalEntry(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateJournalEntryInput) => journalEntriesApi.update(id, input),
    onSuccess: () => invalidateJournalEntry(queryClient, id),
  });
}

export function usePostJournalEntry(id: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => journalEntriesApi.post(id), onSuccess: () => invalidateJournalEntry(queryClient, id) });
}

export function useVoidJournalEntry(id: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => journalEntriesApi.void(id), onSuccess: () => invalidateJournalEntry(queryClient, id) });
}

export function useDeleteJournalEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => journalEntriesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['journalEntries', 'list'] }),
  });
}

// ---- Finance Settings ----

export function useFinanceSettings() {
  return useQuery({ queryKey: ['financeSettings'], queryFn: () => financeSettingsApi.get() });
}

export function useUpdateFinanceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateFinanceSettingsInput) => financeSettingsApi.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financeSettings'] }),
  });
}

// ---- Invoices ----

export function useInvoices(filters: InvoiceFilters) {
  return useQuery({ queryKey: ['invoices', 'list', filters], queryFn: () => invoicesApi.list(filters) });
}

export function useInvoice(id: string | undefined) {
  return useQuery({ queryKey: ['invoices', 'detail', id], queryFn: () => invoicesApi.get(id!), enabled: !!id });
}

function invalidateInvoice(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['invoices', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['invoices', 'list'] });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => invoicesApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices', 'list'] }),
  });
}

export function useUpdateInvoice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateInvoiceInput) => invoicesApi.update(id, input),
    onSuccess: () => invalidateInvoice(queryClient, id),
  });
}

export function useIssueInvoice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => invoicesApi.issue(id), onSuccess: () => invalidateInvoice(queryClient, id) });
}

export function useCancelInvoice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => invoicesApi.cancel(id), onSuccess: () => invalidateInvoice(queryClient, id) });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices', 'list'] }),
  });
}

// ---- Payments ----

export function usePaymentsForInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['payments', 'byInvoice', invoiceId],
    queryFn: () => paymentsApi.listForInvoice(invoiceId!),
    enabled: !!invoiceId,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePaymentInput) => paymentsApi.create(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments', 'byInvoice', variables.invoiceId] });
      invalidateInvoice(queryClient, variables.invoiceId);
    },
  });
}

// ---- Vendors ----

export function useVendors(filters: VendorFilters) {
  return useQuery({ queryKey: ['vendors', 'list', filters], queryFn: () => vendorsApi.list(filters) });
}

export function useVendor(id: string | undefined) {
  return useQuery({ queryKey: ['vendors', 'detail', id], queryFn: () => vendorsApi.get(id!), enabled: !!id });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVendorInput) => vendorsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors', 'list'] }),
  });
}

export function useUpdateVendor(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateVendorInput) => vendorsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['vendors', 'list'] });
    },
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vendorsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors', 'list'] }),
  });
}

// ---- Bills ----

export function useBills(filters: BillFilters) {
  return useQuery({ queryKey: ['bills', 'list', filters], queryFn: () => billsApi.list(filters) });
}

export function useBill(id: string | undefined) {
  return useQuery({ queryKey: ['bills', 'detail', id], queryFn: () => billsApi.get(id!), enabled: !!id });
}

function invalidateBill(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: ['bills', 'detail', id] });
  queryClient.invalidateQueries({ queryKey: ['bills', 'list'] });
}

export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBillInput) => billsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bills', 'list'] }),
  });
}

export function useUpdateBill(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBillInput) => billsApi.update(id, input),
    onSuccess: () => invalidateBill(queryClient, id),
  });
}

export function useReceiveBill(id: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => billsApi.receive(id), onSuccess: () => invalidateBill(queryClient, id) });
}

export function useCancelBill(id: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: () => billsApi.cancel(id), onSuccess: () => invalidateBill(queryClient, id) });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bills', 'list'] }),
  });
}

// ---- Bill Payments ----

export function useBillPaymentsForBill(billId: string | undefined) {
  return useQuery({
    queryKey: ['billPayments', 'byBill', billId],
    queryFn: () => billPaymentsApi.listForBill(billId!),
    enabled: !!billId,
  });
}

export function useCreateBillPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBillPaymentInput) => billPaymentsApi.create(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['billPayments', 'byBill', variables.billId] });
      invalidateBill(queryClient, variables.billId);
    },
  });
}

// ---- Financial Reports (read-only, not enabled until a date is chosen) ----

export function useTrialBalance(asOfDate: string | null) {
  return useQuery({
    queryKey: ['financeReports', 'trialBalance', asOfDate],
    queryFn: () => financialReportsApi.trialBalance(asOfDate!),
    enabled: !!asOfDate,
  });
}

export function useIncomeStatement(fromDate: string | null, toDate: string | null) {
  return useQuery({
    queryKey: ['financeReports', 'incomeStatement', fromDate, toDate],
    queryFn: () => financialReportsApi.incomeStatement(fromDate!, toDate!),
    enabled: !!fromDate && !!toDate,
  });
}

export function useBalanceSheet(asOfDate: string | null) {
  return useQuery({
    queryKey: ['financeReports', 'balanceSheet', asOfDate],
    queryFn: () => financialReportsApi.balanceSheet(asOfDate!),
    enabled: !!asOfDate,
  });
}

export function useCashFlowStatement(fromDate: string | null, toDate: string | null) {
  return useQuery({
    queryKey: ['financeReports', 'cashFlow', fromDate, toDate],
    queryFn: () => financialReportsApi.cashFlow(fromDate!, toDate!),
    enabled: !!fromDate && !!toDate,
  });
}

export function useZakatBaseEstimate(asOfDate: string | null) {
  return useQuery({
    queryKey: ['financeReports', 'zakatBaseEstimate', asOfDate],
    queryFn: () => financialReportsApi.zakatBaseEstimate(asOfDate!),
    enabled: !!asOfDate,
  });
}

export function useCustomerAging(asOfDate: string | null) {
  return useQuery({
    queryKey: ['financeReports', 'customerAging', asOfDate],
    queryFn: () => financialReportsApi.customerAging(asOfDate!),
    enabled: !!asOfDate,
  });
}

export function useCustomerStatement(customerId: string | null, fromDate: string | null, toDate: string | null) {
  return useQuery({
    queryKey: ['financeReports', 'customerStatement', customerId, fromDate, toDate],
    queryFn: () => financialReportsApi.customerStatement(customerId!, fromDate!, toDate!),
    enabled: !!customerId && !!fromDate && !!toDate,
  });
}

export function useAccountLedger(accountId: string | null, fromDate: string | null, toDate: string | null) {
  return useQuery({
    queryKey: ['financeReports', 'accountLedger', accountId, fromDate, toDate],
    queryFn: () => financialReportsApi.accountLedger(accountId!, fromDate!, toDate!),
    enabled: !!accountId && !!fromDate && !!toDate,
  });
}

// ---- Accounting Periods ----

export function usePeriods() {
  return useQuery({ queryKey: ['periods', 'list'], queryFn: () => periodsApi.list() });
}

export function useCreatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePeriodInput) => periodsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periods', 'list'] }),
  });
}

export function useLockPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => periodsApi.lock(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periods', 'list'] }),
  });
}

export function useUnlockPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => periodsApi.unlock(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periods', 'list'] }),
  });
}

export function useZatcaQrCode(invoiceId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['invoices', 'zatcaQr', invoiceId],
    queryFn: () => invoicesApi.getZatcaQrCode(invoiceId!),
    enabled: !!invoiceId && enabled,
  });
}

// ---- Invoice Notes (Credit/Debit) ----

export function useInvoiceNotesForInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ['invoiceNotes', 'byInvoice', invoiceId],
    queryFn: () => invoiceNotesApi.listForInvoice(invoiceId!),
    enabled: !!invoiceId,
  });
}

function invalidateInvoiceNotes(queryClient: ReturnType<typeof useQueryClient>, invoiceId: string) {
  queryClient.invalidateQueries({ queryKey: ['invoiceNotes', 'byInvoice', invoiceId] });
  queryClient.invalidateQueries({ queryKey: ['invoices', 'detail', invoiceId] });
}

export function useCreateInvoiceNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceNoteInput) => invoiceNotesApi.create(input),
    onSuccess: (_data, variables) => invalidateInvoiceNotes(queryClient, variables.invoiceId),
  });
}

export function useIssueInvoiceNote(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoiceNotesApi.issue(id),
    onSuccess: () => invalidateInvoiceNotes(queryClient, invoiceId),
  });
}

export function useCancelInvoiceNote(invoiceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoiceNotesApi.cancel(id),
    onSuccess: () => invalidateInvoiceNotes(queryClient, invoiceId),
  });
}

// ---- Customer Payments (allocation across multiple invoices) ----

export function useCustomerPayments(customerId?: string) {
  return useQuery({ queryKey: ['customerPayments', 'list', customerId], queryFn: () => customerPaymentsApi.list(customerId) });
}

export function useCustomerPayment(id: string | undefined) {
  return useQuery({
    queryKey: ['customerPayments', 'detail', id],
    queryFn: () => customerPaymentsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateCustomerPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCustomerPaymentInput) => customerPaymentsApi.create(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customerPayments', 'list'] });
      // Every allocated invoice's detail/balance may have changed.
      for (const allocation of variables.allocations) {
        queryClient.invalidateQueries({ queryKey: ['invoices', 'detail', allocation.invoiceId] });
      }
      queryClient.invalidateQueries({ queryKey: ['invoices', 'list'] });
    },
  });
}

// ---- Inventory Items (F14/F15) ----

export function useInventoryItems(filters: InventoryItemFilters) {
  return useQuery({ queryKey: ['inventoryItems', 'list', filters], queryFn: () => inventoryItemsApi.list(filters) });
}

export function useInventoryItem(id: string | undefined) {
  return useQuery({
    queryKey: ['inventoryItems', 'detail', id],
    queryFn: () => inventoryItemsApi.get(id!),
    enabled: !!id,
  });
}

export function useInventoryMovements(id: string | undefined) {
  return useQuery({
    queryKey: ['inventoryItems', 'movements', id],
    queryFn: () => inventoryItemsApi.listMovements(id!),
    enabled: !!id,
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInventoryItemInput) => inventoryItemsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventoryItems', 'list'] }),
  });
}

export function useUpdateInventoryItem(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateInventoryItemInput) => inventoryItemsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', 'list'] });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustStockInput) => inventoryItemsApi.adjustStock(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', 'detail', variables.inventoryItemId] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', 'movements', variables.inventoryItemId] });
      queryClient.invalidateQueries({ queryKey: ['inventoryItems', 'list'] });
    },
  });
}

/** A short, rarely-changing reference list — a long staleTime avoids re-fetching it on every currency dropdown mount. */
export function useCurrencies() {
  return useQuery({ queryKey: ['currencies', 'list'], queryFn: () => currenciesApi.list(), staleTime: 30 * 60 * 1000 });
}
