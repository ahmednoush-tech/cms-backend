/**
 * user_roles.scope_id and user_permissions.scope_id are NOT NULL
 * with this fixed sentinel meaning "unscoped — applies
 * company-wide", rather than actual NULL (see migration
 * 109_scoped_roles_and_user_permissions.sql for the full
 * reasoning: Postgres primary keys can't contain a nullable
 * column cleanly, and this environment has no real Prisma install
 * to verify nullable-compound-unique-key `where` behavior against).
 * Every module that reads or writes scope_id must compare against
 * or default to this constant — never hardcode the literal string
 * a second time.
 */
export const COMPANY_WIDE_SCOPE_ID = '00000000-0000-0000-0000-000000000000';
export const COMPANY_WIDE_SCOPE_TYPE = 'company';
