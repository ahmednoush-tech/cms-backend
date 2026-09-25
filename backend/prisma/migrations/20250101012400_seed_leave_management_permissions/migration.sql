-- ============================================================
-- 085_seed_leave_management_permissions.sql
-- DATA ONLY.
--
-- New top-level module 'HR' — leave management doesn't cleanly
-- belong under Administration (employee records/roles) or
-- Payroll (pay runs); it's its own workflow (requests + approval).
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('85000000-0000-0000-0000-000000000001','HR','leave_types','view'),
('85000000-0000-0000-0000-000000000002','HR','leave_types','manage'),
('85000000-0000-0000-0000-000000000003','HR','leave_balances','view'),
('85000000-0000-0000-0000-000000000004','HR','leave_balances','manage'),
('85000000-0000-0000-0000-000000000005','HR','leave_requests','view'),
('85000000-0000-0000-0000-000000000006','HR','leave_requests','create'),
('85000000-0000-0000-0000-000000000007','HR','leave_requests','approve')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'HR'
ON CONFLICT (role_id, permission_id) DO NOTHING;
