-- ============================================================
-- 077_seed_automation_rules_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('57000000-0000-0000-0000-000000000001','CRM','automation_rules','view'),
('57000000-0000-0000-0000-000000000002','CRM','automation_rules','create'),
('57000000-0000-0000-0000-000000000003','CRM','automation_rules','edit'),
('57000000-0000-0000-0000-000000000004','CRM','automation_rules','delete')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'CRM' AND resource = 'automation_rules'
ON CONFLICT (role_id, permission_id) DO NOTHING;
