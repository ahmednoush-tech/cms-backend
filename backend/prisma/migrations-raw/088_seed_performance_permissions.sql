-- ============================================================
-- 088_seed_performance_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('88000000-0000-0000-0000-000000000001','HR','performance_cycles','view'),
('88000000-0000-0000-0000-000000000002','HR','performance_cycles','manage'),
('88000000-0000-0000-0000-000000000003','HR','performance_criteria','view'),
('88000000-0000-0000-0000-000000000004','HR','performance_criteria','manage'),
('88000000-0000-0000-0000-000000000005','HR','performance_evaluations','view'),
('88000000-0000-0000-0000-000000000006','HR','performance_evaluations','create'),
('88000000-0000-0000-0000-000000000007','HR','performance_evaluations','finalize')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'HR' AND resource LIKE 'performance_%'
ON CONFLICT (role_id, permission_id) DO NOTHING;
