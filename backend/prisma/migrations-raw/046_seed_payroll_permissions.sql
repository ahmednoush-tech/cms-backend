-- ============================================================
-- 046_seed_payroll_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('4b000000-0000-0000-0000-000000000001','Payroll','runs','view'),
('4b000000-0000-0000-0000-000000000002','Payroll','runs','create'),
('4b000000-0000-0000-0000-000000000003','Payroll','runs','process'),
('4b000000-0000-0000-0000-000000000004','Payroll','runs','pay'),
('4b000000-0000-0000-0000-000000000005','Payroll','settings','manage')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Payroll'
ON CONFLICT (role_id, permission_id) DO NOTHING;
