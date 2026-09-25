-- ============================================================
-- 090_seed_reports_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('90000000-0000-0000-0000-000000000001','Analytics','custom_reports','view'),
('90000000-0000-0000-0000-000000000002','Analytics','custom_reports','manage')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Analytics' AND resource = 'custom_reports'
ON CONFLICT (role_id, permission_id) DO NOTHING;
