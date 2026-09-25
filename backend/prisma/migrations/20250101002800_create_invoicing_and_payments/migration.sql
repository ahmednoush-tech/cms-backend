-- ============================================================
-- 029_create_invoicing_and_payments.sql
--
-- Phase F2 — builds on F1's Chart of Accounts + Journal Entries:
--   1. finance_settings — one row per company, designating WHICH
--      accounts the system should auto-post to when an invoice is
--      issued or a payment is recorded (e.g. "Accounts Receivable"
--      is account X). Without this configured, issuing an invoice
--      or recording a payment is rejected with a clear message —
--      the system never guesses which account to use.
--   2. invoices / invoice_items — mirrors quotations/quotation_items
--      structurally (draft-only item mutation, totals computed
--      from items, never client-supplied).
--   3. payments — recorded against an invoice; each payment (like
--      each issued invoice) generates its own linked, auto-posted
--      journal entry — never a manual, freeform one for these two
--      specific system-generated cases.
-- ============================================================

CREATE TABLE finance_settings (
  company_id                  UUID PRIMARY KEY REFERENCES companies(id),
  default_receivable_account_id UUID REFERENCES chart_of_accounts(id),
  default_revenue_account_id    UUID REFERENCES chart_of_accounts(id),
  default_tax_payable_account_id UUID REFERENCES chart_of_accounts(id),
  default_cash_account_id       UUID REFERENCES chart_of_accounts(id),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  customer_id    UUID NOT NULL REFERENCES customers(id),
  quotation_id   UUID REFERENCES quotations(id),
  invoice_number VARCHAR(50) NOT NULL,
  issue_date     DATE NOT NULL,
  due_date       DATE,
  status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  subtotal       NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount       NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax            NUMERIC(14,2) NOT NULL DEFAULT 0,
  total          NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid    NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  UNIQUE (company_id, invoice_number),
  -- One invoice per quotation, same pattern as the existing
  -- quotation -> project link (confirmed in quotations.service.ts).
  UNIQUE (quotation_id)
);
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE TABLE invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(12,2) NOT NULL,
  unit_price  NUMERIC(14,2) NOT NULL,
  discount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total       NUMERIC(14,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  invoice_id     UUID NOT NULL REFERENCES invoices(id),
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date   DATE NOT NULL,
  method         VARCHAR(20) NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'card', 'cheque', 'other')),
  reference      VARCHAR(200),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX idx_payments_company_id ON payments(company_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
