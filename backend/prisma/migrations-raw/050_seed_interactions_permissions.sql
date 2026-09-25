-- ============================================================
-- 050_seed_interactions_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('4d000000-0000-0000-0000-000000000001','CRM','interactions','view'),
('4d000000-0000-0000-0000-000000000002','CRM','interactions','create'),
('4d000000-0000-0000-0000-000000000003','CRM','interactions','edit'),
('4d000000-0000-0000-0000-000000000004','CRM','interactions','delete')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'CRM' AND resource = 'interactions'
ON CONFLICT (role_id, permission_id) DO NOTHING;
