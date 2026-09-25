-- ============================================================
-- 082_extend_custom_fields_to_opportunities_customers.sql
--
-- Extends Custom Fields (migration 078) to Opportunities and
-- Customers — the natural next step disclosed at the time as
-- "the architecture generalizes cleanly, only wiring was deferred".
--
-- The dropped/recreated constraint name
-- (custom_field_definitions_entity_type_check) is Postgres's own
-- default naming for an unnamed inline column CHECK — the
-- deterministic pattern `<table>_<column>_check`, which is exactly
-- how migration 078 defined it (no explicit CONSTRAINT name given).
-- ============================================================

ALTER TABLE custom_field_definitions DROP CONSTRAINT custom_field_definitions_entity_type_check;
ALTER TABLE custom_field_definitions ADD CONSTRAINT custom_field_definitions_entity_type_check
  CHECK (entity_type IN ('lead', 'opportunity', 'customer'));

ALTER TABLE opportunities ADD COLUMN custom_fields JSONB NOT NULL DEFAULT '{}';
ALTER TABLE customers ADD COLUMN custom_fields JSONB NOT NULL DEFAULT '{}';
