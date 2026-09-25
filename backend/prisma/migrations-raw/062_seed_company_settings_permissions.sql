-- ============================================================
-- 062_seed_company_settings_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('54000000-0000-0000-0000-000000000001','Administration','company_settings','manage')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Administration' AND resource = 'company_settings'
ON CONFLICT (role_id, permission_id) DO NOTHING;
