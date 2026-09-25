-- ============================================================
-- 031_create_expenses_and_payables.sql
--
-- Phase F4 — the mirror image of F2 (Invoicing + Payments):
-- money going OUT (bills owed to vendors, payments made to them)
-- instead of money coming IN. Structurally identical to F2's
-- invoices/invoice_items/payments, with the direction reversed.
--
--   1. vendors — mirrors customers.
--   2. bills / bill_items — mirrors invoices/invoice_items.
--   3. bill_payments — a SEPARATE table from `payments` (F2's
--      customer-payment table), even though the shape is similar,
--      specifically so a query against "payments" can never
--      accidentally mix money coming in with money going out —
--      the two are fundamentally different accounting facts.
--   4. finance_settings gains two more nullable columns: the
--      default Accounts Payable account and default Expense
--      account (mirroring receivable/revenue), plus a Tax
--      Recoverable account for input VAT — the two are always
--      kept separate from the existing Tax Payable column (output
--      VAT), never conflated.
-- ============================================================

ALTER TABLE finance_settings
  ADD COLUMN default_payable_account_id UUID REFERENCES chart_of_accounts(id),
  ADD COLUMN default_expense_account_id UUID REFERENCES chart_of_accounts(id),
  ADD COLUMN default_tax_recoverable_account_id UUID REFERENCES chart_of_accounts(id);

CREATE TABLE vendors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id),
  vendor_code  VARCHAR(50) NOT NULL,
  name         VARCHAR(200) NOT NULL,
  email        VARCHAR(255),
  phone        VARCHAR(50),
  address      TEXT,
  city         VARCHAR(100),
  country      VARCHAR(100),
  status       VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,
  UNIQUE (company_id, vendor_code)
);
CREATE INDEX idx_vendors_company_id ON vendors(company_id);

CREATE TABLE bills (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  vendor_id      UUID NOT NULL REFERENCES vendors(id),
  bill_number    VARCHAR(50) NOT NULL,
  vendor_reference VARCHAR(200), -- the vendor's OWN invoice number, for reconciliation — distinct from our internal bill_number
  bill_date      DATE NOT NULL,
  due_date       DATE,
  status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'received', 'partially_paid', 'paid', 'overdue', 'cancelled')),
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
  UNIQUE (company_id, bill_number)
);
CREATE INDEX idx_bills_company_id ON bills(company_id);
CREATE INDEX idx_bills_vendor_id ON bills(vendor_id);
CREATE INDEX idx_bills_status ON bills(status);

CREATE TABLE bill_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(12,2) NOT NULL,
  unit_price  NUMERIC(14,2) NOT NULL,
  discount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total       NUMERIC(14,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_items_bill_id ON bill_items(bill_id);

CREATE TABLE bill_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  bill_id        UUID NOT NULL REFERENCES bills(id),
  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date   DATE NOT NULL,
  method         VARCHAR(20) NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'card', 'cheque', 'other')),
  reference      VARCHAR(200),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX idx_bill_payments_company_id ON bill_payments(company_id);
CREATE INDEX idx_bill_payments_bill_id ON bill_payments(bill_id);
