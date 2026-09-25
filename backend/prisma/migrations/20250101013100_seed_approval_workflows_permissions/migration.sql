-- ============================================================
-- 092_seed_approval_workflows_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('92000000-0000-0000-0000-000000000001','Administration','approval_workflows','view'),
('92000000-0000-0000-0000-000000000002','Administration','approval_workflows','manage'),
('92000000-0000-0000-0000-000000000003','Administration','approval_requests','create'),
('92000000-0000-0000-0000-000000000004','Administration','approval_requests','action')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Administration' AND resource IN ('approval_workflows', 'approval_requests')
ON CONFLICT (role_id, permission_id) DO NOTHING;
