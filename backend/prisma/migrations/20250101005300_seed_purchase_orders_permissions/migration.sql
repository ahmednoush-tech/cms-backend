-- ============================================================
-- 054_seed_purchase_orders_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('50000000-0000-0000-0000-000000000001','Finance','purchase_orders','view'),
('50000000-0000-0000-0000-000000000002','Finance','purchase_orders','create'),
('50000000-0000-0000-0000-000000000003','Finance','purchase_orders','edit'),
('50000000-0000-0000-0000-000000000004','Finance','purchase_orders','approve'),
('50000000-0000-0000-0000-000000000005','Finance','purchase_orders','send'),
('50000000-0000-0000-0000-000000000006','Finance','purchase_orders','delete')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource = 'purchase_orders'
ON CONFLICT (role_id, permission_id) DO NOTHING;
