-- ============================================================
-- 105_create_attachment_signatures.sql
--
-- A signature is recorded against ONE SPECIFIC attachment row
-- (one version), never against a document_group_id — signing v1
-- of a document must never be silently treated as also signing a
-- later v2 with genuinely different content. If a document is
-- re-versioned after being signed, the old signature stays
-- attached to the old version only, and the new version shows as
-- unsigned until someone signs it too.
--
-- signature_type distinguishes a typed name acknowledgment from a
-- drawn (canvas) signature — signature_data holds the typed text
-- or a base64 PNG accordingly.
--
-- This is NOT a legally-binding e-signature system: no PKI, no
-- identity verification beyond "this authenticated user clicked
-- sign", no certificate chain, no long-term signature validation.
-- It is an audit record of acknowledgment, not a substitute for a
-- real e-signature provider where that is legally required.
-- ============================================================

CREATE TABLE attachment_signatures (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  attachment_id  UUID NOT NULL REFERENCES attachments(id),
  signed_by      UUID NOT NULL REFERENCES users(id),
  signature_type VARCHAR(20) NOT NULL CHECK (signature_type IN ('typed', 'drawn')),
  signature_data TEXT NOT NULL,
  ip_address     VARCHAR(45),
  signed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachment_signatures_attachment ON attachment_signatures(attachment_id);

ALTER TABLE attachment_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_attachment_signatures ON attachment_signatures
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');
