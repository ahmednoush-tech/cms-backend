export type BankReconciliationStatus = 'in_progress' | 'completed';

export interface BankStatementLine {
  id: string;
  bankReconciliationId: string;
  transactionDate: string;
  description: string;
  amount: string;
  matchedJournalEntryLineId: string | null;
  createdAt: string;
  matchedJournalEntryLine?: {
    id: string;
    debit: string;
    credit: string;
    description: string | null;
    journalEntry: { id: string; entryNumber: string; entryDate: string; reference: string | null; description: string | null };
  } | null;
}

export interface UnmatchedLedgerLine {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string | null;
  journalEntry: { id: string; entryNumber: string; entryDate: string; reference: string | null; description: string | null };
}

export interface BankReconciliation {
  id: string;
  companyId: string;
  bankAccountId: string;
  statementDate: string;
  statementEndingBalance: string;
  bookBalance: string | null;
  status: BankReconciliationStatus;
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  bankAccount?: { id: string; code: string; name: string };
  statementLines?: BankStatementLine[];
}

export interface CreateBankReconciliationInput {
  bankAccountId: string;
  statementDate: string;
  statementEndingBalance: number;
}

export interface AddStatementLineInput {
  transactionDate: string;
  description: string;
  amount: number;
}

export interface AutoMatchResult {
  matchedCount: number;
  remainingUnmatched: number;
}
