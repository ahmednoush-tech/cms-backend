-- ============================================================
-- 079_seed_custom_fields_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('58000000-0000-0000-0000-000000000001','CRM','custom_fields','view'),
('58000000-0000-0000-0000-000000000002','CRM','custom_fields','create'),
('58000000-0000-0000-0000-000000000003','CRM','custom_fields','edit'),
('58000000-0000-0000-0000-000000000004','CRM','custom_fields','delete')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'CRM' AND resource = 'custom_fields'
ON CONFLICT (role_id, permission_id) DO NOTHING;
