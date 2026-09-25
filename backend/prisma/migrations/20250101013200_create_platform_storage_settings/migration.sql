-- ============================================================
-- 093_create_platform_storage_settings.sql
--
-- PLATFORM-WIDE STORAGE SETTINGS
--
-- File storage (local disk vs S3) is a PLATFORM-LEVEL setting, not
-- a per-company one — every tenant company shares the same
-- storage backend and bucket (files are already isolated between
-- companies via key prefixing, e.g. "{companyId}/{fileName}", not
-- via separate buckets). A regular company admin must NOT be able
-- to reconfigure storage for the whole platform, so this is only
-- ever managed through platform-admin endpoints
-- (PlatformAdminAuthGuard), never exposed to tenant-company users.
--
-- Singleton row, same pattern as platform_settings (migration
-- 081): one fixed id, no company_id.
--
-- s3_secret_access_key_encrypted is stored via the SAME
-- AES-256-GCM utility already used for Microsoft Client Secret
-- (credentials-encryption.util.ts) — never in plaintext, and never
-- returned by the GET endpoint (see PlatformStorageSettingsService).
-- ============================================================

CREATE TABLE platform_storage_settings (
  id                              UUID PRIMARY KEY,
  storage_driver                  VARCHAR(20) NOT NULL DEFAULT 'local' CHECK (storage_driver IN ('local', 's3')),
  s3_region                       VARCHAR(50),
  s3_bucket                       VARCHAR(255),
  s3_access_key_id                VARCHAR(255),
  s3_secret_access_key_encrypted  TEXT,
  s3_endpoint                     VARCHAR(500),
  s3_force_path_style             BOOLEAN NOT NULL DEFAULT false,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seeded defaulting to 'local' — a fresh install keeps working
-- exactly as before this feature existed, with zero required
-- action. A platform admin opts into S3 later via the settings UI.
INSERT INTO platform_storage_settings (id, storage_driver)
VALUES ('00000000-0000-0000-0000-00000000005f', 'local');
