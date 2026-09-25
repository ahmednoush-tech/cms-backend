-- ============================================================
-- 110_create_revoked_refresh_tokens.sql
--
-- Replaces TokenDenylistService's in-memory Map<jti, expiry> — a
-- real, self-disclosed problem: revoking a refresh token on one
-- app instance never had any effect on a different instance
-- behind a load balancer, since each instance held its own
-- separate in-memory list. This table makes revocation a shared,
-- durable fact instead of per-process state.
--
-- No company_id / no Row Level Security — a jti is a globally
-- unique token identifier regardless of which tenant's user it
-- belongs to, the same reasoning that already applies to the
-- global `permissions` table (also has no RLS, confirmed against
-- migration 064 before writing this one).
--
-- expires_at lets isRevoked() treat a naturally-expired entry as
-- irrelevant without needing it deleted first; a periodic cleanup
-- of rows past their expiry keeps the table from growing forever,
-- but is a housekeeping concern, not a correctness one.
-- ============================================================

CREATE TABLE revoked_refresh_tokens (
  jti        VARCHAR(255) PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_revoked_refresh_tokens_expires_at ON revoked_refresh_tokens(expires_at);
