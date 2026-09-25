-- ============================================================
-- 042_seed_customer_payments_permission.sql
-- DATA ONLY. Creation reuses the existing Finance:payments:create
-- permission (it produces the exact same underlying Payment rows
-- as a single-invoice payment always has) — only viewing the
-- customer-payment "receipt" grouping is a genuinely new
-- capability worth its own permission.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('49000000-0000-0000-0000-000000000001','Finance','customer_payments','view')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource = 'customer_payments'
ON CONFLICT (role_id, permission_id) DO NOTHING;
