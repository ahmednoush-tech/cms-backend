-- ============================================================
-- 058_seed_attachments_permissions.sql
-- DATA ONLY.
--
-- A single permission namespace covers attachments on EVERY
-- entity type — not per-module permissions. Access to the
-- underlying record itself (e.g. Finance:bills:view) already
-- gates whether someone can reach an entity's detail page to see
-- its attachments in the first place; this permission only
-- controls the upload/delete actions.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('52000000-0000-0000-0000-000000000001','Common','attachments','view'),
('52000000-0000-0000-0000-000000000002','Common','attachments','upload'),
('52000000-0000-0000-0000-000000000003','Common','attachments','delete')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Common' AND resource = 'attachments'
ON CONFLICT (role_id, permission_id) DO NOTHING;
