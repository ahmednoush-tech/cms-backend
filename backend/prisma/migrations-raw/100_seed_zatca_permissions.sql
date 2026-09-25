-- ============================================================
-- 100_seed_zatca_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('a0000000-0000-0000-0000-000000000001','Finance','zatca','manage'),
('a0000000-0000-0000-0000-000000000002','Finance','zatca','view')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource = 'zatca'
ON CONFLICT (role_id, permission_id) DO NOTHING;
