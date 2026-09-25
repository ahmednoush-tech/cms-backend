-- ============================================================
-- 103_add_zatca_qr_code_storage.sql
--
-- ECDSA signing (ZatcaCryptoService.signXml) is non-deterministic
-- by design — signing the same content twice produces two
-- different (both equally valid) signatures. This means the
-- Phase 2 QR code, which embeds ONE specific signature, cannot be
-- safely recomputed after the fact — doing so would silently
-- produce a DIFFERENT QR than the one actually submitted to (and
-- cleared/reported by) ZATCA, even though both would
-- independently verify. The QR actually used must be computed
-- once, at submission time, and stored verbatim.
-- ============================================================

ALTER TABLE zatca_submissions ADD COLUMN qr_code_base64 TEXT;
