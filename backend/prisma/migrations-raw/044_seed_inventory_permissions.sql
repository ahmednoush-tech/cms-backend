-- ============================================================
-- 044_seed_inventory_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('4f000000-0000-0000-0000-000000000001','Finance','inventory','view'),
('4f000000-0000-0000-0000-000000000002','Finance','inventory','create'),
('4f000000-0000-0000-0000-000000000003','Finance','inventory','edit'),
('4f000000-0000-0000-0000-000000000004','Finance','inventory','adjust')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource = 'inventory'
ON CONFLICT (role_id, permission_id) DO NOTHING;
