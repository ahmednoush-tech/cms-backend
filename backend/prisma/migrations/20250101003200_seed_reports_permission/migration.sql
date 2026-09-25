-- ============================================================
-- 033_seed_reports_permission.sql
-- DATA ONLY. No new tables — Phase F5 (Financial Statements) is
-- purely read/aggregation over the existing chart_of_accounts +
-- journal_entries + journal_entry_lines data from F1.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('46000000-0000-0000-0000-000000000001','Finance','reports','view')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource = 'reports'
ON CONFLICT (role_id, permission_id) DO NOTHING;
