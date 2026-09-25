-- ============================================================
-- 034_create_accounting_periods.sql
--
-- Phase F6 — the core piece: once a period is LOCKED, no journal
-- entry (manual, or auto-generated from invoicing/payments) may
-- be posted with an entry_date falling inside it. Enforced at the
-- application layer (PeriodLockService.assertDateNotLocked, called
-- from every entry-creating code path), not by a DB constraint,
-- since Postgres cannot easily express "check this date against
-- another table's ranges" as a CHECK constraint.
--
-- Deliberately does NOT include an automatic closing entry that
-- zeroes revenue/expense into a Retained Earnings account — this
-- system computes account balances by summing historical lines
-- (never physically resetting them), so a closing entry dated at
-- period-end would double-count against that SAME period's own
-- income statement query. Getting that right needs more design
-- work than this pass allows; shipping the LOCK (the part that
-- actually prevents the data-integrity problem this phase exists
-- to solve) without a half-correct auto-close is the safer choice.
-- ============================================================

CREATE TABLE accounting_periods (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name       VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  status     VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked')),
  locked_at  TIMESTAMPTZ,
  locked_by  UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX idx_accounting_periods_company_id ON accounting_periods(company_id);
CREATE INDEX idx_accounting_periods_dates ON accounting_periods(company_id, start_date, end_date);
