-- ============================================================
-- 106_seed_attachment_sign_permission.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('52000000-0000-0000-0000-000000000004','Common','attachments','sign')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Common' AND resource = 'attachments' AND action = 'sign'
ON CONFLICT (role_id, permission_id) DO NOTHING;
