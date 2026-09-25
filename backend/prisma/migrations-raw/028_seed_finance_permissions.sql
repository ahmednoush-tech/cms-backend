-- ============================================================
-- 028_seed_finance_permissions.sql
--
-- DATA ONLY — no ALTER TABLE, no new columns, no new tables.
-- Adds the Finance module permission rows. Unlike Operations/CRM,
-- no dedicated demo role (e.g. "Accountant") is seeded here —
-- the existing Roles UI (Phase 3E) already supports creating a
-- custom role and granting it these permissions, so inventing a
-- new demo role isn't necessary. Super Admin gets everything, as
-- with every other module.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('43000000-0000-0000-0000-000000000001','Finance','accounts','view'),
('43000000-0000-0000-0000-000000000002','Finance','accounts','create'),
('43000000-0000-0000-0000-000000000003','Finance','accounts','edit'),
('43000000-0000-0000-0000-000000000004','Finance','accounts','delete'),
('43000000-0000-0000-0000-000000000005','Finance','journal_entries','view'),
('43000000-0000-0000-0000-000000000006','Finance','journal_entries','create'),
('43000000-0000-0000-0000-000000000007','Finance','journal_entries','edit'),
('43000000-0000-0000-0000-000000000008','Finance','journal_entries','delete'),
('43000000-0000-0000-0000-000000000009','Finance','journal_entries','post')
ON CONFLICT (module, resource, action) DO NOTHING;

-- Super Admin gets every Finance permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance'
ON CONFLICT (role_id, permission_id) DO NOTHING;
