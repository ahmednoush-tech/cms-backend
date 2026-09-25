-- ============================================================
-- 059_create_bank_reconciliation.sql
--
-- Bank Reconciliation. A reconciliation is scoped to ONE bank
-- account as of ONE statement date. Statement lines are entered
-- and matched one-to-one against posted journal entry lines
-- already in the ledger for that account.
--
-- Completion uses the standard two-sided reconciliation formula,
-- not a naive "book balance should equal statement balance":
--
--   adjusted bank balance = statement_ending_balance
--                          + sum(unmatched ledger line net amounts)
--   adjusted book balance = book_balance (computed at completion)
--                          + sum(unmatched statement line amounts)
--
-- These two must be EXACTLY equal to complete — an outstanding
-- check or a deposit in transit (an unmatched ledger line) and an
-- unrecorded bank fee or interest credit (an unmatched statement
-- line) are the NORMAL, expected reason the two raw balances
-- differ, not evidence of an error. A completion attempt with a
-- non-zero variance is rejected with the exact variance amount —
-- there is no "force complete anyway" override, matching this
-- system's consistent rule elsewhere that an imbalance is never
-- silently accepted.
--
-- Deliberately NOT built here: importing a bank statement file
-- (CSV format varies bank to bank) — statement lines are entered
-- one at a time via the API in this version. Also not built:
-- automatically creating the missing journal entry for an
-- unmatched bank-only item (e.g. a bank fee) — the user records
-- that separately as an ordinary journal entry, then matches it
-- here, the same as any other transaction.
-- ============================================================

CREATE TABLE bank_reconciliations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID NOT NULL REFERENCES companies(id),
  bank_account_id          UUID NOT NULL REFERENCES chart_of_accounts(id),
  statement_date           DATE NOT NULL,
  statement_ending_balance NUMERIC(14,2) NOT NULL,
  book_balance             NUMERIC(14,2),
  status                   VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  completed_at             TIMESTAMPTZ,
  created_by               UUID REFERENCES users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, bank_account_id, statement_date)
);
CREATE INDEX idx_bank_reconciliations_company_id ON bank_reconciliations(company_id);
CREATE INDEX idx_bank_reconciliations_account_id ON bank_reconciliations(bank_account_id);

CREATE TABLE bank_statement_lines (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_reconciliation_id       UUID NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  transaction_date             DATE NOT NULL,
  description                  TEXT NOT NULL,
  amount                       NUMERIC(14,2) NOT NULL,
  matched_journal_entry_line_id UUID REFERENCES journal_entry_lines(id),
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (matched_journal_entry_line_id)
);
CREATE INDEX idx_bank_statement_lines_reconciliation_id ON bank_statement_lines(bank_reconciliation_id);
