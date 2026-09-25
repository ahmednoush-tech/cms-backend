-- ============================================================
-- 041_create_customer_payments.sql
--
-- Phase F11 — allocate ONE payment received from a customer
-- across MULTIPLE invoices. Deliberately additive, not a
-- restructuring of the existing `payments` table: a
-- customer_payments row represents the single, physical amount
-- received (e.g. one bank transfer covering three invoices).
-- Each individual `payments` row underneath it is created exactly
-- as it always has been (same validation, same journal entry
-- logic, same invoice status transition) — this table only adds
-- the "receipt" wrapper and tracks any UNAPPLIED portion (money
-- received but not yet allocated to a specific invoice, e.g. an
-- advance payment).
-- ============================================================

CREATE TABLE customer_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id),
  customer_id      UUID NOT NULL REFERENCES customers(id),
  amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  unapplied_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (unapplied_amount >= 0),
  payment_date     DATE NOT NULL,
  method           VARCHAR(20) NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'card', 'cheque', 'other')),
  reference        VARCHAR(200),
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_payments_company_id ON customer_payments(company_id);
CREATE INDEX idx_customer_payments_customer_id ON customer_payments(customer_id);

ALTER TABLE payments
  ADD COLUMN customer_payment_id UUID REFERENCES customer_payments(id);
CREATE INDEX idx_payments_customer_payment_id ON payments(customer_payment_id);
