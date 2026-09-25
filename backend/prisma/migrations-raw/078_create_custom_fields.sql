-- ============================================================
-- 078_create_custom_fields.sql
--
-- Custom Fields — lets an admin define ADDITIONAL fields for a
-- CRM entity from the UI, with no code change or deployment.
--
-- DELIBERATELY SCOPED TO LEADS ONLY for this version — the
-- entity_type CHECK constraint below only allows 'lead'. The
-- architecture (a definitions table + a JSONB column on the
-- entity) generalizes cleanly to Opportunity/Customer, but wiring
-- the actual validation into THREE separate existing services in
-- one pass risked a half-finished result. Extending the CHECK
-- constraint and adding opportunities.custom_fields /
-- customers.custom_fields columns is the natural next migration.
--
-- STORAGE CHOICE: field VALUES live in a JSONB column
-- (leads.custom_fields) on the entity itself, not a separate
-- Entity-Attribute-Value table — simpler to query and update, at
-- the cost of not being able to add a SQL-level CHECK constraint
-- on individual field values (that validation happens in the
-- application layer — see CustomFieldValidationService).
-- ============================================================

CREATE TABLE custom_field_definitions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  entity_type    VARCHAR(20) NOT NULL CHECK (entity_type IN ('lead')),
  field_key      VARCHAR(50) NOT NULL,
  label          VARCHAR(200) NOT NULL,
  field_type     VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select')),
  select_options JSONB,
  is_required    BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  display_order  INTEGER NOT NULL DEFAULT 0,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, entity_type, field_key),
  CONSTRAINT chk_select_options_present CHECK (
    (field_type = 'select' AND select_options IS NOT NULL) OR
    (field_type != 'select' AND select_options IS NULL)
  )
);
CREATE INDEX idx_custom_field_definitions_lookup ON custom_field_definitions(company_id, entity_type, is_active);

ALTER TABLE leads ADD COLUMN custom_fields JSONB NOT NULL DEFAULT '{}';

-- ---- Row-Level Security (same pattern as prior migrations) ----
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON custom_field_definitions
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
