-- ============================================================
-- 081_create_platform_settings.sql
--
-- PLATFORM SETTINGS — Mizan's own editable product identity
-- (name, tagline, logo), previously static (common:productName/
-- productTagline translation keys, branding.ts's logoUrl). Now
-- editable by Mizan's own ops team from a real settings screen,
-- fetched live by every screen that shows the product's own
-- branding (ProductBar, login/signup screens).
--
-- SINGLETON PATTERN: this table always has EXACTLY ONE row, with
-- a fixed, known id, enforced in the application layer
-- (PlatformSettingsService always reads/writes THIS ONE id, never
-- creates a second row). The fixed id is deliberately obvious/
-- greppable, not a random UUID, so its singleton nature is
-- visible from the seed data itself.
--
-- Company-level branding (each TENANT's own name/logo) is a
-- SEPARATE, pre-existing concern — companies.name/logo — and is
-- NOT touched by this migration.
-- ============================================================

CREATE TABLE platform_settings (
  id               UUID PRIMARY KEY,
  product_name     VARCHAR(100) NOT NULL,
  product_tagline  VARCHAR(200),
  logo_url         VARCHAR(500),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (id, product_name, product_tagline, logo_url)
VALUES ('00000000-0000-0000-0000-00000000005e', 'ميزان', 'منصة إدارة الأعمال', NULL);

-- No RLS — same rationale as platform_admins (migration 080):
-- this table has no company_id and is structurally outside the
-- tenant model.
