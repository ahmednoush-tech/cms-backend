-- ============================================================
-- 056_seed_fixed_assets_permissions.sql
-- DATA ONLY.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('51000000-0000-0000-0000-000000000001','Finance','fixed_assets','view'),
('51000000-0000-0000-0000-000000000002','Finance','fixed_assets','create'),
('51000000-0000-0000-0000-000000000003','Finance','fixed_assets','edit'),
('51000000-0000-0000-0000-000000000004','Finance','fixed_assets','dispose'),
('51000000-0000-0000-0000-000000000005','Finance','depreciation_runs','view'),
('51000000-0000-0000-0000-000000000006','Finance','depreciation_runs','create')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource IN ('fixed_assets', 'depreciation_runs')
ON CONFLICT (role_id, permission_id) DO NOTHING;
