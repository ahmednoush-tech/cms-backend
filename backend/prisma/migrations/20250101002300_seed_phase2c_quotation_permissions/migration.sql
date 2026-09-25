-- ============================================================
-- 024_seed_phase2c_quotation_permissions.sql
--
-- DATA ONLY — no ALTER TABLE, no new columns, no new tables.
-- view/create/edit/delete for CRM:quotations already exist
-- (020, 023). This adds the three lifecycle-action permissions
-- the new send/accept/reject endpoints require, and grants them
-- to Super Admin (all) and Sales (CRM module) — same pattern as
-- 022 and 023.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('41000000-0000-0000-0000-000000000037','CRM','quotations','send'),
('41000000-0000-0000-0000-000000000038','CRM','quotations','accept'),
('41000000-0000-0000-0000-000000000039','CRM','quotations','reject')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'CRM' AND resource = 'quotations'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '33333333-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'CRM' AND resource = 'quotations'
ON CONFLICT (role_id, permission_id) DO NOTHING;
