-- ============================================================
-- 101_add_zatca_address_fields.sql
--
-- Discovered while building the ZATCA Phase 2 UBL invoice XML
-- builder: finance_settings had no structured seller address, and
-- customers had no VAT number field — both are MANDATORY in
-- ZATCA's UBL 2.1 invoice schema (seller postal address block;
-- buyer VAT number on Standard/B2B invoices subject to
-- clearance). Without these, any XML this feature produces would
-- be schema-invalid regardless of how correct everything else is.
--
-- All nullable — a company not yet using ZATCA Phase 2 is
-- unaffected, and the XML builder / clearance flow validates
-- these are present before attempting to build/submit an invoice
-- that needs them, rather than the database enforcing it broadly.
-- ============================================================

ALTER TABLE finance_settings ADD COLUMN seller_street_name VARCHAR(200);
ALTER TABLE finance_settings ADD COLUMN seller_building_number VARCHAR(10);
ALTER TABLE finance_settings ADD COLUMN seller_district VARCHAR(100);
ALTER TABLE finance_settings ADD COLUMN seller_city VARCHAR(100);
ALTER TABLE finance_settings ADD COLUMN seller_postal_code VARCHAR(10);

ALTER TABLE customers ADD COLUMN vat_registration_number VARCHAR(15);
