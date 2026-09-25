-- ============================================================
-- 067_seed_recurring_invoices_permissions.sql
-- DATA ONLY.
--
-- "generate" is intentionally separate from "create"/"edit" — the
-- same pattern already used for Finance:bank_reconciliation:complete
-- and Finance:purchase_orders:approve.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('55000000-0000-0000-0000-000000000001','Finance','recurring_invoices','view'),
('55000000-0000-0000-0000-000000000002','Finance','recurring_invoices','create'),
('55000000-0000-0000-0000-000000000003','Finance','recurring_invoices','edit'),
('55000000-0000-0000-0000-000000000004','Finance','recurring_invoices','generate')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource = 'recurring_invoices'
ON CONFLICT (role_id, permission_id) DO NOTHING;
