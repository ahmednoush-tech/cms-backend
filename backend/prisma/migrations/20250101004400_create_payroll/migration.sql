-- ============================================================
-- 045_create_payroll.sql
--
-- Payroll foundation. Saudi GOSI (social insurance) rates are
-- genuinely complex and change over time: two parallel
-- registration systems (pre/post 3 July 2024) with different
-- combined rates, annual scheduled increases through 2028, and
-- entirely different treatment for Saudi nationals versus
-- non-Saudi expatriates. This system has no nationality or
-- GOSI-registration-date data model, so rather than hardcode a
-- rate that will already be wrong for some employees and stale
-- within months for everyone, GOSI employee/employer rates are
-- stored PER EMPLOYEE, entered explicitly by the company
-- (verified against gosi.gov.sa), defaulting to NULL/zero rather
-- than any guessed percentage.
--
-- End-of-service gratuity (EOSG) is NOT built here — it requires
-- accrual accounting most companies would want reviewed with an
-- accountant before automating, exactly like Zakat.
-- ============================================================

ALTER TABLE employees
  ADD COLUMN basic_salary NUMERIC(14,2),
  ADD COLUMN housing_allowance NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN other_allowances NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN gosi_employee_rate NUMERIC(6,3),
  ADD COLUMN gosi_employer_rate NUMERIC(6,3),
  ADD COLUMN hourly_rate NUMERIC(10,2);

CREATE TABLE payroll_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID NOT NULL UNIQUE REFERENCES companies(id),
  salary_expense_account_id UUID REFERENCES chart_of_accounts(id),
  gosi_employer_expense_account_id UUID REFERENCES chart_of_accounts(id),
  gosi_payable_account_id   UUID REFERENCES chart_of_accounts(id),
  net_pay_payable_account_id UUID REFERENCES chart_of_accounts(id),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payroll_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  month                 SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year                  SMALLINT NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'paid', 'cancelled')),
  total_gross           NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_gosi_employee   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_gosi_employer   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_net             NUMERIC(14,2) NOT NULL DEFAULT 0,
  journal_entry_id      UUID REFERENCES journal_entries(id),
  payment_journal_entry_id UUID REFERENCES journal_entries(id),
  processed_at          TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, month, year)
);
CREATE INDEX idx_payroll_runs_company_id ON payroll_runs(company_id);

CREATE TABLE payslips (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id          UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id             UUID NOT NULL REFERENCES employees(id),
  basic_salary            NUMERIC(14,2) NOT NULL,
  housing_allowance       NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_allowances        NUMERIC(14,2) NOT NULL DEFAULT 0,
  gross_pay               NUMERIC(14,2) NOT NULL,
  gosi_employee_rate      NUMERIC(6,3) NOT NULL DEFAULT 0,
  gosi_employer_rate      NUMERIC(6,3) NOT NULL DEFAULT 0,
  gosi_employee_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  gosi_employer_contribution NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_pay                 NUMERIC(14,2) NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);
CREATE INDEX idx_payslips_payroll_run_id ON payslips(payroll_run_id);
CREATE INDEX idx_payslips_employee_id ON payslips(employee_id);
