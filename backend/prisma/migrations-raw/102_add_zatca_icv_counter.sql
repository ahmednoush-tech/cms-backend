-- ============================================================
-- 102_add_zatca_icv_counter.sql
--
-- ZATCA's Invoice Counter Value (ICV) must be a strictly
-- sequential integer across every invoice a company submits under
-- a given production CSID — never reused, never skipped, and
-- distinct from this system's own invoice numbering. Stored on
-- finance_settings as a single running counter, incremented
-- atomically (via an UPDATE ... SET last_zatca_icv = last_zatca_icv + 1,
-- inside the same transaction as recording the submission) rather
-- than computed by counting existing zatca_submissions rows, which
-- would race under concurrent invoice issuance.
-- ============================================================

ALTER TABLE finance_settings ADD COLUMN last_zatca_icv INTEGER NOT NULL DEFAULT 0;
