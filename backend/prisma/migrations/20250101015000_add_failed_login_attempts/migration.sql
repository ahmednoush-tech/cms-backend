-- ============================================================
-- 111_add_failed_login_attempts.sql
--
-- Replaces AuthService's in-memory failedAttempts Map<email, count>
-- — the same real, self-disclosed multi-instance problem
-- TokenDenylistService had before migration 110: a count reset by
-- a failed attempt hitting a DIFFERENT app instance behind a load
-- balancer would let a brute-force attempt bypass the account
-- lockout threshold entirely, since each instance kept its own
-- separate counter. Storing the count directly on the user row
-- makes it shared, durable state instead of per-process memory,
-- and Prisma's increment operation compiles to an atomic
-- `SET failed_login_attempts = failed_login_attempts + 1` at the
-- database level — safe under concurrent failed attempts in a way
-- the old read-then-write Map access never strictly guaranteed.
-- ============================================================

ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
