-- ============================================================
-- 069_seed_fleet_permissions.sql
-- DATA ONLY.
--
-- "assign" is separate from "edit" — assigning/returning a
-- vehicle to an employee is a distinct operational action from
-- editing the vehicle's own record.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('56000000-0000-0000-0000-000000000001','Fleet','vehicles','view'),
('56000000-0000-0000-0000-000000000002','Fleet','vehicles','create'),
('56000000-0000-0000-0000-000000000003','Fleet','vehicles','edit'),
('56000000-0000-0000-0000-000000000004','Fleet','vehicles','assign'),
('56000000-0000-0000-0000-000000000005','Fleet','maintenance','create')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Fleet'
ON CONFLICT (role_id, permission_id) DO NOTHING;
