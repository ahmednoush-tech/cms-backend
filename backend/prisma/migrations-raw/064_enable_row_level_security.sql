-- ============================================================
-- 064_enable_row_level_security.sql
--
-- Row-Level Security enforced by POSTGRES ITSELF, not just
-- application code discipline. Every query on every tenant
-- table below is now filtered by the database — even a future
-- bug that forgets a `WHERE companyId = ...` clause in the
-- application layer can no longer leak another company's rows,
-- because Postgres silently drops non-matching rows before
-- the application ever sees them.
--
-- HOW THE COMPANY CONTEXT REACHES POSTGRES: the application
-- sets a session-local variable, app.current_company_id, via
-- `SET LOCAL` at the start of every request's transaction (see
-- backend/src/prisma/tenant-context.ts and
-- backend/src/prisma/rls.extension.ts). `current_setting(...,
-- true)` returns NULL when that variable is unset — and since
-- `company_id = NULL` is never true in SQL, a request with no
-- tenant context set sees ZERO rows from every policy below.
-- This is FAIL-CLOSED by construction, not fail-open: a bug
-- that forgets to set the context blocks all data, it does
-- not accidentally expose all of it.
--
-- THE ONE ESCAPE HATCH: app.bypass_rls, set to 'on' by exactly
-- two, narrowly-scoped, already-audited services that must
-- read across tenants for a legitimate PRE-AUTHENTICATION
-- reason — PublicQuotationService (a quotation opened via its
-- own unguessable UUID share link) and PublicCompanyInfoService
-- (the login screen's name/logo, before anyone has signed in).
-- Grep the codebase for `bypass_rls` — it should return exactly
-- those two call sites and nowhere else, ever.
--
-- NOT covered by a policy here: `permissions` — a small, fixed,
-- GLOBAL reference table (the same permission catalog for every
-- company), not tenant data, so it is deliberately left
-- world-readable to any authenticated connection.
--
-- IMPORTANT VERIFICATION NOTE: this migration's SQL syntax has
-- been checked for correctness, but this development
-- environment has no live PostgreSQL instance to actually RUN
-- these policies against — there is no substitute for testing
-- this for real (e.g. two companies' data side by side, one
-- session per company, confirming zero cross-tenant leakage)
-- on an actual running database before relying on it.
-- ============================================================

-- ---- The tenant root itself ----
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON companies
  USING (
    id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- ---- Direct tenant tables (own company_id column) ----
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON accounting_periods
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON activity_logs
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON attachments
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE bank_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bank_reconciliations
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bill_payments
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bills
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chart_of_accounts
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON comments
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customer_payments
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE customer_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customer_users
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customers
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON departments
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE depreciation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON depreciation_runs
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON employees
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE finance_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON finance_settings
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON fixed_assets
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON interactions
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventory_items
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventory_movements
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE invoice_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoice_notes
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoices
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON journal_entries
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON leads
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notifications
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON opportunities
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payments
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payroll_runs
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE payroll_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payroll_settings
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON purchase_orders
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON quotations
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON roles
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tasks
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON time_entries
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vendors
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON work_orders
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- ---- Child tables (scoped via a parent's company_id) ----
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON journal_entry_lines
  USING (
    journal_entry_id IN (
      SELECT id FROM journal_entries
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoice_items
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bill_items
  USING (
    bill_id IN (
      SELECT id FROM bills
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customer_contacts
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON quotation_items
  USING (
    quotation_id IN (
      SELECT id FROM quotations
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON project_members
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE invoice_note_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoice_note_items
  USING (
    note_id IN (
      SELECT id FROM invoice_notes
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payslips
  USING (
    payroll_run_id IN (
      SELECT id FROM payroll_runs
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON purchase_order_items
  USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE depreciation_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON depreciation_entries
  USING (
    depreciation_run_id IN (
      SELECT id FROM depreciation_runs
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE bank_statement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON bank_statement_lines
  USING (
    bank_reconciliation_id IN (
      SELECT id FROM bank_reconciliations
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_roles
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON role_permissions
  USING (
    role_id IN (
      SELECT id FROM roles
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON password_reset_tokens
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );
