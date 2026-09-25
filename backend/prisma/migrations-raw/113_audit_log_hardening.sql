-- ============================================================
-- 113_audit_log_hardening.sql
--
-- 1. user_agent — the browser/client of each audited action,
--    captured automatically alongside the (now actually populated)
--    ip_address. See TenantContext.requestMeta.
--
-- 2. APPEND-ONLY: audit entries can be added, never edited or
--    deleted. Enforced by the database itself, so it holds no matter
--    which code path — or which bug — tries otherwise. Covers
--    UPDATE, DELETE and TRUNCATE.
--
--    Consequence, intended: users.id -> activity_logs.user_id is
--    ON DELETE SET NULL, so HARD-deleting a user who appears in the
--    audit trail is now refused (it would erase who performed those
--    actions). The application only ever soft-deletes users
--    (verified: no hard user delete exists in the codebase), so
--    normal operation is unaffected.
--
--    Escape hatch for a future, deliberate retention/archival job:
--    that job must run in its own transaction with
--      SELECT set_config('app.audit_maintenance', 'on', true);
--    No application code sets this today. A database owner can of
--    course still drop the trigger — this protects against the
--    application and its bugs, not against someone with full DB
--    superuser access.
--
-- 3. Indexes for the audit viewer's filters, all company-scoped
--    since every query is: by date, by actor, and an entity's full
--    history.
-- ============================================================

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500);

CREATE OR REPLACE FUNCTION activity_logs_append_only() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.audit_maintenance', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'activity_logs is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_logs_no_update_delete ON activity_logs;
CREATE TRIGGER activity_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION activity_logs_append_only();

DROP TRIGGER IF EXISTS activity_logs_no_truncate ON activity_logs;
CREATE TRIGGER activity_logs_no_truncate
  BEFORE TRUNCATE ON activity_logs
  FOR EACH STATEMENT EXECUTE FUNCTION activity_logs_append_only();

CREATE INDEX IF NOT EXISTS idx_activity_company_created ON activity_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_company_user_created ON activity_logs(company_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_company_entity ON activity_logs(company_id, entity_type, entity_id, created_at DESC);
