-- ============================================================
-- 107_granular_users_permissions.sql
-- DATA ONLY.
--
-- Discovered via a real question about how employee vs. user
-- account permissions compare: Employees already have granular
-- view/create/edit/delete permissions, but Users had only a
-- single all-or-nothing 'manage' permission — every endpoint in
-- users.controller.ts, including the plain GET list, required it.
-- That meant there was no way to grant someone read-only
-- visibility into the user list (e.g. to see who has portal
-- access) without also handing them the ability to delete any
-- account or reset any password. This replaces 'manage' with the
-- same four-permission shape Employees already use.
--
-- Any role that already had 'manage' is granted all four new
-- permissions here, so existing role assignments keep working
-- exactly as before — nobody loses access as a result of this
-- migration. The old 'manage' permission is then deleted; its
-- role_permissions rows are removed automatically via the
-- ON DELETE CASCADE already defined on that relation.
-- ============================================================

INSERT INTO permissions (id, module, resource, action) VALUES
('305227f4-995c-4468-8b53-cbc7f3001ce5','Administration','users','view'),
('33f22ab2-ff7f-4661-930c-12fb2390e88e','Administration','users','create'),
('810432e1-46f0-430e-a904-f27f64c4e201','Administration','users','edit'),
('4ca35783-5580-40e3-9e69-73c258643571','Administration','users','delete')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM role_permissions rp
CROSS JOIN permissions p
WHERE rp.permission_id = '41000000-0000-0000-0000-000000000019'
  AND p.id IN ('305227f4-995c-4468-8b53-cbc7f3001ce5','33f22ab2-ff7f-4661-930c-12fb2390e88e','810432e1-46f0-430e-a904-f27f64c4e201','4ca35783-5580-40e3-9e69-73c258643571')
ON CONFLICT (role_id, permission_id) DO NOTHING;

DELETE FROM permissions WHERE id = '41000000-0000-0000-0000-000000000019';
