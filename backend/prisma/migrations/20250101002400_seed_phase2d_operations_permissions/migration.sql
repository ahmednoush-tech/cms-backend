-- ============================================================
-- 025_seed_phase2d_operations_permissions.sql
--
-- DATA ONLY — no ALTER TABLE, no new columns, no new tables.
-- Adds the Operations module permission rows and grants them to
-- Super Admin (all) and Operations (all Operations permissions)
-- per the seeded role structure from 020. Same pattern as
-- 022/023/024.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('42000000-0000-0000-0000-000000000001','Operations','projects','view'),
('42000000-0000-0000-0000-000000000002','Operations','projects','create'),
('42000000-0000-0000-0000-000000000003','Operations','projects','edit'),
('42000000-0000-0000-0000-000000000004','Operations','projects','delete'),
('42000000-0000-0000-0000-000000000005','Operations','projects','assign'),
('42000000-0000-0000-0000-000000000006','Operations','work_orders','view'),
('42000000-0000-0000-0000-000000000007','Operations','work_orders','create'),
('42000000-0000-0000-0000-000000000008','Operations','work_orders','edit'),
('42000000-0000-0000-0000-000000000009','Operations','work_orders','delete'),
('42000000-0000-0000-0000-000000000010','Operations','work_orders','assign'),
('42000000-0000-0000-0000-000000000011','Operations','tasks','view'),
('42000000-0000-0000-0000-000000000012','Operations','tasks','create'),
('42000000-0000-0000-0000-000000000013','Operations','tasks','edit'),
('42000000-0000-0000-0000-000000000014','Operations','tasks','delete'),
('42000000-0000-0000-0000-000000000015','Operations','tasks','assign'),
('42000000-0000-0000-0000-000000000016','Operations','project_members','view'),
('42000000-0000-0000-0000-000000000017','Operations','project_members','manage')
ON CONFLICT (module, resource, action) DO NOTHING;

-- Super Admin gets every Operations permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Operations'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Operations role gets every Operations permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT '34444444-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Operations'
ON CONFLICT (role_id, permission_id) DO NOTHING;
