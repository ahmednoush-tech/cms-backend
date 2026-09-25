-- ============================================================
-- 035_seed_periods_permissions.sql
-- DATA ONLY. Same pattern as prior Finance permission seeds.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('47000000-0000-0000-0000-000000000001','Finance','periods','view'),
('47000000-0000-0000-0000-000000000002','Finance','periods','manage')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource = 'periods'
ON CONFLICT (role_id, permission_id) DO NOTHING;
