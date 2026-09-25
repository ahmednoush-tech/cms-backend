-- ============================================================
-- 065_create_recurring_invoices.sql
--
-- Recurring/subscription billing. A template describes WHAT to
-- bill a customer and HOW OFTEN — actually creating the next
-- invoice happens via an explicit "generate due invoices now"
-- action (see RecurringInvoiceTemplatesService.generateDue()),
-- the SAME on-demand pattern already used for Depreciation Runs.
--
-- THIS IS NOT A REAL CRON/SCHEDULER. This system has no background
-- job infrastructure. In production, generateDue() would be called
-- by an external scheduled trigger (e.g. the hosting platform's
-- own cron feature hitting this endpoint daily) — that trigger is
-- NOT set up by this migration or its service; someone still needs
-- to configure it once the system is actually deployed.
--
-- next_generation_date is the single source of truth for "is this
-- template due" — advanced by generateDue() after each successful
-- generation, using calendar-aware month/quarter/year arithmetic
-- that clamps to month-end rather than silently rolling into the
-- wrong month (e.g. Jan 31 + 1 month lands on Feb 28, not Mar 3).
--
-- Each generated Invoice keeps a link back to the template that
-- created it (recurring_template_id on invoices) — purely
-- informational; editing a template only affects FUTURE
-- generations, never invoices already created.
-- ============================================================

CREATE TABLE recurring_invoice_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  customer_id           UUID NOT NULL REFERENCES customers(id),
  name                  VARCHAR(200) NOT NULL,
  currency_code         VARCHAR(3) NOT NULL DEFAULT 'SAR' REFERENCES currencies(code),
  exchange_rate_to_base NUMERIC(14,6) NOT NULL DEFAULT 1,
  frequency             VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  start_date            DATE NOT NULL,
  next_generation_date  DATE NOT NULL,
  end_date              DATE,
  status                VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  notes                 TEXT,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recurring_invoice_templates_company_id ON recurring_invoice_templates(company_id);
CREATE INDEX idx_recurring_invoice_templates_due ON recurring_invoice_templates(company_id, status, next_generation_date);

CREATE TABLE recurring_invoice_template_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES recurring_invoice_templates(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(14,2) NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  discount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax         NUMERIC(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_recurring_invoice_template_items_template_id ON recurring_invoice_template_items(template_id);

ALTER TABLE invoices ADD COLUMN recurring_template_id UUID REFERENCES recurring_invoice_templates(id);
