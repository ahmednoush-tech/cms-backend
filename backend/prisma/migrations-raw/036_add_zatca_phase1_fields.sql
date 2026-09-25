-- ============================================================
-- 036_add_zatca_phase1_fields.sql
--
-- Phase F7 — ZATCA Phase 1 (Generation Phase) compliance ONLY.
-- Deliberately does NOT attempt Phase 2 (Integration): that phase
-- requires a Cryptographic Stamp Identifier issued by ZATCA
-- through their onboarding portal (an OTP + certificate exchange
-- with a real ZATCA account), real-time API calls to the Fatoora
-- platform for clearance/reporting, and UBL 2.1 XML with digital
-- signatures — none of which can be built or simulated without
-- an actual ZATCA-registered account. Attempting a fake version
-- of that would create false confidence in legal compliance.
--
-- Two additions:
--   1. invoices.issued_at — the PRECISE timestamp of the moment
--      an invoice was issued (date AND time), required for QR
--      Tag 3. Deliberately separate from issue_date (a DATE-only
--      business-selected field, set by the user, that may not
--      match the exact system time of issuance).
--   2. finance_settings gains the seller identity fields the QR
--      code needs: the legal seller name and 15-digit VAT
--      registration number. These live in Finance Settings (not
--      the existing frontend-only branding config) because they
--      are legal, auditable facts about the company's tax
--      registration, not cosmetic branding.
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN issued_at TIMESTAMPTZ;

ALTER TABLE finance_settings
  ADD COLUMN seller_name VARCHAR(200),
  ADD COLUMN vat_registration_number VARCHAR(15);
