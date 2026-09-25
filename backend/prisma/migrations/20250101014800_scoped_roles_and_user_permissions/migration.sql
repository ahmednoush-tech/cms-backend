-- ============================================================
-- 109_scoped_roles_and_user_permissions.sql
--
-- Two related access-control features requested together:
--
-- 1. SCOPED / DELEGATED ADMIN — a role assignment can now be
--    limited to one record of a given scope type (e.g. one
--    department) instead of always applying company-wide. Adds
--    scope_type/scope_id to user_roles.
--
-- 2. DIRECT PER-USER PERMISSION GRANTS ("permission sets") — a
--    single extra permission can now be granted straight to a
--    user without creating or editing a role. New user_permissions
--    table, same scoping columns as user_roles for the same
--    reason (a one-off grant might also need to be scoped).
--
-- scope_id is NOT NULL with a fixed sentinel UUID meaning
-- "unscoped / company-wide", rather than actual NULL — Postgres
-- primary keys can't contain a nullable column cleanly (multiple
-- NULLs count as distinct, which would silently allow duplicate
-- "unscoped" grants of the same role to slip in), and there is no
-- real Prisma install available in this environment to verify
-- nullable-compound-unique-key `where` behavior empirically. The
-- sentinel sidesteps needing to trust that untested behavior at
-- all. See common/constants/scope.constants.ts's
-- COMPANY_WIDE_SCOPE_ID constant —
-- that is the single source of truth for this literal; nothing
-- else should hardcode it.
-- ============================================================

ALTER TABLE user_roles
  ADD COLUMN scope_type VARCHAR(30) NOT NULL DEFAULT 'company',
  ADD COLUMN scope_id   UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Every existing grant becomes an explicit unscoped (company-wide)
-- grant, identical in effect to how it behaved before this
-- migration — the DEFAULT above already gives new rows this value,
-- this UPDATE is only for rows that existed before the DEFAULT was
-- added (harmless no-op if there are none).
UPDATE user_roles SET scope_type = 'company', scope_id = '00000000-0000-0000-0000-000000000000'
  WHERE scope_type IS NULL OR scope_id IS NULL;

ALTER TABLE user_roles DROP CONSTRAINT user_roles_pkey;
ALTER TABLE user_roles ADD PRIMARY KEY (user_id, role_id, scope_id);

CREATE TABLE user_permissions (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  scope_type    VARCHAR(30) NOT NULL DEFAULT 'company',
  scope_id      UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id, scope_id)
);

-- Same tenant-isolation pattern as user_roles (confirmed by
-- reading that table's own policy, migration 064) — neither table
-- has its own company_id column, so isolation goes through the
-- user this row belongs to.
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_permissions
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- Permission gating who can grant/revoke a direct per-user
-- permission — deliberately separate from Administration:roles:manage
-- (scoped role assignment reuses that existing permission, since
-- it is still assigning a whole role) because handing someone the
-- power to grant ANY single permission directly, bypassing roles
-- entirely, is a meaningfully bigger capability than assigning a
-- pre-defined role.
INSERT INTO permissions (id, module, resource, action) VALUES
('63ffe851-fe78-4011-bc42-233ea20d9252','Administration','user_permissions','manage')
ON CONFLICT (module, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '31111111-1111-1111-1111-111111111111', id FROM permissions
WHERE module = 'Administration' AND resource = 'user_permissions' AND action = 'manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
