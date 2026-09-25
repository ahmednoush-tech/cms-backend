-- ============================================================
-- 066_enable_rls_on_recurring_invoices.sql
--
-- migration 064 enabled Row-Level Security on every tenant table
-- that existed AT THAT TIME. recurring_invoice_templates and
-- recurring_invoice_template_items were created afterward (see
-- migration 065) and therefore start with ZERO RLS protection —
-- a new table is not automatically covered by policies written
-- for other tables. This migration closes that gap immediately,
-- in the same feature that introduced the tables, rather than
-- leaving it as a silent, easy-to-forget follow-up.
-- ============================================================

ALTER TABLE recurring_invoice_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON recurring_invoice_templates
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE recurring_invoice_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON recurring_invoice_template_items
  USING (
    template_id IN (
      SELECT id FROM recurring_invoice_templates
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );
