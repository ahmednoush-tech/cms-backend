-- ============================================================
-- 074_add_company_microsoft_credentials.sql
--
-- Moves Outlook integration credentials from server-wide
-- environment variables to per-company, admin-configurable
-- settings — each company registers its OWN Azure App
-- Registration and enters its own Client ID/Secret from a
-- settings screen, rather than a developer setting one shared
-- MICROSOFT_CLIENT_ID/SECRET for the whole deployment.
--
-- microsoft_client_secret_encrypted stores CIPHERTEXT, produced by
-- the application layer's AES-256-GCM encryption (see
-- credentials-encryption.util.ts) — the plaintext secret is never
-- written to the database and is never returned by any API
-- response after the initial save (the GET endpoint returns only
-- a secretConfigured boolean, never the value, encrypted or not).
-- ============================================================

ALTER TABLE companies ADD COLUMN microsoft_client_id VARCHAR(255);
ALTER TABLE companies ADD COLUMN microsoft_client_secret_encrypted TEXT;
