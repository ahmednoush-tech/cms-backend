-- ============================================================
-- 032_seed_expenses_permissions.sql
-- DATA ONLY. Same pattern as 028/030.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('45000000-0000-0000-0000-000000000001','Finance','vendors','view'),
('45000000-0000-0000-0000-000000000002','Finance','vendors','create'),
('45000000-0000-0000-0000-000000000003','Finance','vendors','edit'),
('45000000-0000-0000-0000-000000000004','Finance','vendors','delete'),
('45000000-0000-0000-0000-000000000005','Finance','bills','view'),
('45000000-0000-0000-0000-000000000006','Finance','bills','create'),
('45000000-0000-0000-0000-000000000007','Finance','bills','edit'),
('45000000-0000-0000-0000-000000000008','Finance','bills','delete'),
('45000000-0000-0000-0000-000000000009','Finance','bills','receive'),
('45000000-0000-0000-0000-000000000010','Finance','bill_payments','view'),
('45000000-0000-0000-0000-000000000011','Finance','bill_payments','create')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource IN ('vendors', 'bills', 'bill_payments')
ON CONFLICT (role_id, permission_id) DO NOTHING;
