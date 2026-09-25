-- ============================================================
-- 060_seed_bank_reconciliation_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('53000000-0000-0000-0000-000000000001','Finance','bank_reconciliation','view'),
('53000000-0000-0000-0000-000000000002','Finance','bank_reconciliation','create'),
('53000000-0000-0000-0000-000000000003','Finance','bank_reconciliation','complete')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource = 'bank_reconciliation'
ON CONFLICT (role_id, permission_id) DO NOTHING;
