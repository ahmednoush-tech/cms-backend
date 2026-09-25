-- ============================================================
-- 027_create_finance_foundation.sql
--
-- Phase F1 — the foundation every later Finance phase (invoicing,
-- payments, financial statements, ZATCA e-invoicing) builds on:
--   1. chart_of_accounts — the company's own account hierarchy
--      (asset/liability/equity/revenue/expense).
--   2. journal_entries — the header of a double-entry posting.
--   3. journal_entry_lines — the actual debit/credit lines. A
--      posted entry's lines must sum to zero (debits == credits);
--      this is enforced at the application layer (JournalEntryService,
--      using Decimal arithmetic — never JS floats for money, same
--      rule as QuotationCalculator), not by a DB constraint, since
--      Postgres cannot easily express "sum of sibling rows must
--      balance" as a CHECK constraint.
-- ============================================================

CREATE TABLE chart_of_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  code           VARCHAR(20) NOT NULL,
  name           VARCHAR(200) NOT NULL,
  type           VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  parent_id      UUID REFERENCES chart_of_accounts(id),
  description    TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  UNIQUE (company_id, code)
);
CREATE INDEX idx_chart_of_accounts_company_id ON chart_of_accounts(company_id);
CREATE INDEX idx_chart_of_accounts_parent_id ON chart_of_accounts(parent_id);

CREATE TABLE journal_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id),
  entry_number  VARCHAR(50) NOT NULL,
  entry_date    DATE NOT NULL,
  reference     VARCHAR(200),
  description   TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
  created_by    UUID REFERENCES users(id),
  posted_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (company_id, entry_number)
);
CREATE INDEX idx_journal_entries_company_id ON journal_entries(company_id);
CREATE INDEX idx_journal_entries_entry_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);

CREATE TABLE journal_entry_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit            NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description      TEXT,
  line_order       INTEGER NOT NULL DEFAULT 0,
  -- A line is either a debit or a credit, never both at once (a
  -- line with both = 0 is allowed only transiently while a draft
  -- entry is being edited).
  CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX idx_journal_entry_lines_journal_entry_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);
