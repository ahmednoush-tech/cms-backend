-- ============================================================
-- 022_seed_phase2b_permissions.sql
--
-- DATA ONLY — no ALTER TABLE, no new columns, no new tables.
-- Adds the (module, resource, action) rows needed by the new
-- Phase 2B Departments/Employees endpoints, and grants them to
-- the seeded Super Admin / Manager roles. This does not touch
-- the approved schema in any way.
--
-- Also flags an open question for your decision (see README):
-- activity_logs.entity_type's CHECK list (migration 018) does
-- not include 'department', so department create/update/delete
-- is not currently written to activity_logs. No schema change
-- has been made without your approval.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('41000000-0000-0000-0000-000000000021','Administration','departments','view'),
('41000000-0000-0000-0000-000000000022','Administration','departments','create'),
('41000000-0000-0000-0000-000000000023','Administration','departments','edit'),
('41000000-0000-0000-0000-000000000024','Administration','departments','delete'),
('41000000-0000-0000-0000-000000000025','Administration','employees','view'),
('41000000-0000-0000-0000-000000000026','Administration','employees','create'),
('41000000-0000-0000-0000-000000000027','Administration','employees','edit'),
('41000000-0000-0000-0000-000000000028','Administration','employees','delete')
ON CONFLICT (module, resource, action) DO NOTHING;

-- Super Admin already gets every permission via the wildcard
-- seed in 020 only if re-run after this file; to be safe, grant
-- explicitly here too (idempotent via composite PK conflict).
INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Administration' AND resource IN ('departments','employees')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager role gets view/edit on departments and employees
-- (not create/delete — reasonable default, adjust as needed).
INSERT INTO role_permissions (role_id, permission_id)
SELECT '32222222-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Administration'
  AND resource IN ('departments','employees')
  AND action IN ('view','edit')
ON CONFLICT (role_id, permission_id) DO NOTHING;
