-- ============================================================
-- 052_add_quotation_public_token.sql
--
-- A shareable, unauthenticated "view this quote" link. The token
-- is a random UUID (122 bits of entropy) used as the ONLY lookup
-- key for the public endpoint — never the quotation's own
-- sequential id, which would make enumeration trivial. Every
-- existing quotation backfills a token automatically via the
-- column default, so this never leaves a quotation without one.
-- ============================================================

ALTER TABLE quotations
  ADD COLUMN public_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX idx_quotations_public_token ON quotations(public_token);
