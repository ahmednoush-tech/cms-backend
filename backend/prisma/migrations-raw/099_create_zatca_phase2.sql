-- ============================================================
-- 099_create_zatca_phase2.sql
--
-- ZATCA PHASE 2 (INTEGRATION PHASE) — DATA MODEL ONLY.
--
-- IMPORTANT, READ BEFORE USING IN PRODUCTION: this migration and
-- the application code built on it were developed WITHOUT access
-- to a live ZATCA (Fatoora) sandbox or production environment.
-- Field shapes, statuses, and the onboarding flow below reflect
-- ZATCA's PUBLISHED technical specification as understood at
-- implementation time, but ZATCA's exact API contracts, CSR
-- requirements, and XML schema details are known to change, and
-- have NOT been verified against a real request/response cycle.
-- Before this goes anywhere near a real business's tax
-- compliance, every request/response shape here must be verified
-- against ZATCA's current sandbox by someone with real portal
-- access and a real test VAT registration.
--
-- zatca_certificates: one row per CSID (Cryptographic Stamp
-- Identifier) lifecycle step. A company's real onboarding
-- produces TWO CSIDs in sequence — 'compliance' (used only to run
-- ZATCA's compliance checks against sample invoices) and
-- 'production' (the one actually used for live clearance/
-- reporting) — hence csid_type rather than one row per company.
-- private_key_encrypted uses the SAME AES-256-GCM utility already
-- used for Microsoft Client Secret and the S3 secret key
-- (credentials-encryption.util.ts) — this key signs every
-- invoice submitted while this CSID is active, so it is exactly
-- as sensitive as those.
--
-- zatca_submissions: an immutable audit log, one row per attempt
-- to clear (standard/B2B invoices) or report (simplified/B2C
-- invoices) a specific invoice to ZATCA. Kept separate from the
-- invoices table itself because a submission can be RETRIED, and
-- collapsing that history onto a single mutable invoice row would
-- lose exactly the audit trail a tax authority integration most
-- needs.
-- ============================================================

CREATE TABLE zatca_certificates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  csid_type             VARCHAR(20) NOT NULL CHECK (csid_type IN ('compliance', 'production')),
  private_key_encrypted TEXT NOT NULL,
  csr_pem               TEXT,
  certificate_pem       TEXT,
  binary_security_token TEXT,
  api_secret_encrypted  TEXT,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending_csr' CHECK (status IN ('pending_csr', 'pending_zatca_issuance', 'active', 'expired', 'revoked')),
  zatca_request_id      VARCHAR(100),
  issued_at             TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE zatca_submissions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id),
  invoice_id           UUID NOT NULL REFERENCES invoices(id),
  certificate_id       UUID NOT NULL REFERENCES zatca_certificates(id),
  submission_type      VARCHAR(20) NOT NULL CHECK (submission_type IN ('clearance', 'reporting')),
  zatca_invoice_uuid   VARCHAR(100) NOT NULL,
  invoice_hash         VARCHAR(100) NOT NULL,
  previous_invoice_hash VARCHAR(100) NOT NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'reported', 'rejected', 'failed')),
  request_xml          TEXT,
  response_body        TEXT,
  zatca_warnings       TEXT,
  cleared_invoice_xml  TEXT,
  submitted_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_zatca_certificates_company ON zatca_certificates(company_id, csid_type);
CREATE INDEX idx_zatca_submissions_invoice ON zatca_submissions(invoice_id);
CREATE INDEX idx_zatca_submissions_company_status ON zatca_submissions(company_id, status);

ALTER TABLE zatca_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_zatca_certificates ON zatca_certificates
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE zatca_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_zatca_submissions ON zatca_submissions
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');
