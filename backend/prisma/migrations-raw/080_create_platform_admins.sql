-- ============================================================
-- 080_create_platform_admins.sql
--
-- PLATFORM ADMIN — Mizan's own operations team, completely
-- separate from tenant Users. Deliberately its own table (not an
-- `is_platform_admin` boolean on the users table) so that:
--   1. A compromised tenant User account can NEVER escalate to
--      cross-company access — there is no flag on that row to
--      flip, because platform admins aren't rows in that table.
--   2. Platform admins have no company_id at all — they are not
--      "super users within a company", they sit structurally
--      above the entire multi-tenant model.
--   3. RLS on this table is irrelevant by design: platform_admins
--      has no company_id column, so no tenant policy could apply
--      to it even by mistake.
--
-- SCOPE: this migration is authentication + company visibility
-- only (login, list/view companies, basic usage counts). Real
-- subscription/billing management (plans, payment processing,
-- invoicing customer companies) is a separate, larger feature not
-- built here.
-- ============================================================

CREATE TABLE platform_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS enabled on this table at all — see the comment above.
-- This is intentional, not an oversight: RLS policies scope by
-- company_id, and this table structurally has none.
