-- ============================================================
-- 030_seed_invoicing_permissions.sql
-- DATA ONLY. Same pattern as 028: Super Admin gets everything;
-- a custom role can be granted these via the existing Roles UI.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('44000000-0000-0000-0000-000000000001','Finance','settings','manage'),
('44000000-0000-0000-0000-000000000002','Finance','invoices','view'),
('44000000-0000-0000-0000-000000000003','Finance','invoices','create'),
('44000000-0000-0000-0000-000000000004','Finance','invoices','edit'),
('44000000-0000-0000-0000-000000000005','Finance','invoices','delete'),
('44000000-0000-0000-0000-000000000006','Finance','invoices','issue'),
('44000000-0000-0000-0000-000000000007','Finance','payments','view'),
('44000000-0000-0000-0000-000000000008','Finance','payments','create'),
('44000000-0000-0000-0000-000000000009','Finance','payments','delete')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource IN ('settings', 'invoices', 'payments')
ON CONFLICT (role_id, permission_id) DO NOTHING;
