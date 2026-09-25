-- ============================================================
-- 061_add_company_tax_number.sql
--
-- The only company-info field genuinely missing before a real
-- Company Settings page can replace the deploy-time
-- VITE_BRAND_* environment variables the frontend currently
-- relies on. Every other field a quotation/invoice header prints
-- (name, address, phone, email, logo) already existed on
-- Company — this was the one gap.
-- ============================================================

ALTER TABLE companies ADD COLUMN tax_number VARCHAR(20);
