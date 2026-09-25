-- ============================================================
-- 038_seed_invoice_notes_permissions.sql
-- DATA ONLY. Same pattern as prior Finance permission seeds.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('48000000-0000-0000-0000-000000000001','Finance','invoice_notes','view'),
('48000000-0000-0000-0000-000000000002','Finance','invoice_notes','create'),
('48000000-0000-0000-0000-000000000003','Finance','invoice_notes','issue'),
('48000000-0000-0000-0000-000000000004','Finance','invoice_notes','delete')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Finance' AND resource = 'invoice_notes'
ON CONFLICT (role_id, permission_id) DO NOTHING;
