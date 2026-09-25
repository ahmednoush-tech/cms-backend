-- ============================================================
-- 048_seed_time_entries_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('4c000000-0000-0000-0000-000000000001','Operations','time_entries','view'),
('4c000000-0000-0000-0000-000000000002','Operations','time_entries','create'),
('4c000000-0000-0000-0000-000000000003','Operations','time_entries','edit'),
('4c000000-0000-0000-0000-000000000004','Operations','time_entries','delete')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Operations' AND resource = 'time_entries'
ON CONFLICT (role_id, permission_id) DO NOTHING;
