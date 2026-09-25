-- ============================================================
-- 051_seed_analytics_permissions.sql
-- DATA ONLY.
--
-- Business Intelligence / Analytics is read-only and spans
-- Finance + CRM + Operations data, so it gets its OWN permission
-- namespace rather than piggy-backing on any one module's — a
-- company may want to grant an executive "view analytics" without
-- granting edit rights anywhere else.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('4f000000-0000-0000-0000-000000000010','Analytics','reports','view')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Analytics'
ON CONFLICT (role_id, permission_id) DO NOTHING;
