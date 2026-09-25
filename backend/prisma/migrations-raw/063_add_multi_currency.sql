-- ============================================================
-- 063_add_multi_currency.sql
--
-- Multi-currency support, DELIBERATELY SCOPED to Quotations and
-- Invoices only — the documents actually sent to customers, and
-- the most common real-world need (invoicing a foreign client
-- while the company's own books stay in one base currency).
--
-- NOT extended in this migration to: Bills, Purchase Orders,
-- Payroll, Fixed Assets, or Bank Reconciliation — all of those
-- remain single-currency (implicitly SAR) until a genuine need
-- and a proper design pass justifies extending each one.
--
-- THE BASE CURRENCY IS SAR, HARD-CODED, NOT CONFIGURABLE. Every
-- journal entry line in this system's General Ledger is posted in
-- SAR regardless of what currency the source document was in — a
-- foreign-currency invoice's amount is converted to SAR using its
-- own frozen exchange rate before ever touching the ledger. This
-- keeps every existing financial report correct with zero changes
-- to any report query.
--
-- exchange_rate_to_base is FROZEN AT CREATION TIME on both the
-- document (Quotation/Invoice) and, separately, at payment time
-- on Payment — exactly the same "freeze the rate/price at the
-- historical moment" pattern already used for payroll rates,
-- inventory movement costs, and invoice line prices elsewhere in
-- this system. A rate is never looked up live at read time.
--
-- default_fx_gain_loss_account_id on finance_settings is required
-- ONLY the first time a payment is actually applied to a
-- foreign-currency invoice at a different rate than the invoice
-- was issued at — mirroring the same "configure the account only
-- when you actually need it" pattern used for the tax payable
-- account.
-- ============================================================

CREATE TABLE currencies (
  code       VARCHAR(3) PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  symbol     VARCHAR(5) NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO currencies (code, name, symbol) VALUES
  ('SAR', 'Saudi Riyal', 'ر.س'),
  ('USD', 'US Dollar', '$'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£'),
  ('AED', 'UAE Dirham', 'د.إ'),
  ('KWD', 'Kuwaiti Dinar', 'د.ك'),
  ('EGP', 'Egyptian Pound', 'ج.م');

ALTER TABLE quotations
  ADD COLUMN currency_code VARCHAR(3) NOT NULL DEFAULT 'SAR' REFERENCES currencies(code),
  ADD COLUMN exchange_rate_to_base NUMERIC(14,6) NOT NULL DEFAULT 1;

ALTER TABLE invoices
  ADD COLUMN currency_code VARCHAR(3) NOT NULL DEFAULT 'SAR' REFERENCES currencies(code),
  ADD COLUMN exchange_rate_to_base NUMERIC(14,6) NOT NULL DEFAULT 1;

ALTER TABLE payments
  ADD COLUMN exchange_rate_to_base NUMERIC(14,6) NOT NULL DEFAULT 1;

ALTER TABLE finance_settings
  ADD COLUMN default_fx_gain_loss_account_id UUID REFERENCES chart_of_accounts(id);
