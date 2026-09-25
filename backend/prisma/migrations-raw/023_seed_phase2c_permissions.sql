-- ============================================================
-- 023_seed_phase2c_permissions.sql
--
-- DATA ONLY — no ALTER TABLE, no new columns, no new tables.
-- Adds (module, resource, action) rows for the Phase 2C CRM
-- endpoints and grants them to Super Admin (all) and Sales
-- (CRM module) per the seeded role structure from 020.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('41000000-0000-0000-0000-000000000029','CRM','opportunities','edit'),
('41000000-0000-0000-0000-000000000030','CRM','opportunities','delete'),
('41000000-0000-0000-0000-000000000031','CRM','quotations','edit'),
('41000000-0000-0000-0000-000000000032','CRM','quotations','delete'),
('41000000-0000-0000-0000-000000000033','CRM','customers','edit'),
('41000000-0000-0000-0000-000000000034','CRM','customers','delete'),
('41000000-0000-0000-0000-000000000035','CRM','leads','edit'),
('41000000-0000-0000-0000-000000000036','CRM','leads','delete')
ON CONFLICT (module, resource, action) DO NOTHING;
-- (view/create for customers/leads/opportunities/quotations were
-- already seeded in 020_seed_roles_permissions.sql — this file
-- fills in the edit/delete actions the CRUD endpoints also need.)

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'CRM'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '33333333-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'CRM'
ON CONFLICT (role_id, permission_id) DO NOTHING;
