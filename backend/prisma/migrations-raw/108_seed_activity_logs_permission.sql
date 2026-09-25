-- ============================================================
-- 108_seed_activity_logs_permission.sql
-- DATA ONLY.
--
-- Adds the permission gating the new activity-log viewer (added
-- this session so that the permission/role audit entries now being
-- recorded — see roles.service.ts's ActivityLogService.record()
-- calls — are actually visible to someone, not just written to a
-- table nobody can query from the UI).
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('cd4056fc-7a70-47d1-be7d-428351852ea0','Administration','activity_logs','view')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Administration' AND resource = 'activity_logs' AND action = 'view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
