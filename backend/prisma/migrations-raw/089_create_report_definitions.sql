-- ============================================================
-- 089_create_report_definitions.sql
--
-- CUSTOM REPORTS ENGINE
--
-- SAFE-BY-DESIGN, not a generic query builder: entity_type,
-- group_by_field, aggregate_field, and every filter field name
-- stored here are just STRINGS at the database level — the actual
-- safety comes from the application layer (see
-- reports-registry.ts), which validates every one of these
-- strings against a fixed, hardcoded allow-list before ever using
-- them to build a Prisma query. No raw SQL is built from this
-- data, and no column/table name from this table is ever
-- interpolated into a query string. A malicious or malformed
-- row here can, at worst, cause the report to fail validation —
-- it can never reach the database as an arbitrary identifier.
--
-- filters is a JSON array of {field, operator, value} objects,
-- validated the same way — every 'field' checked against that
-- entity's allowed filter fields in the registry.
-- ============================================================

CREATE TABLE report_definitions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id),
  name             VARCHAR(150) NOT NULL,
  entity_type      VARCHAR(50) NOT NULL,
  group_by_field   VARCHAR(50) NOT NULL,
  aggregate_type   VARCHAR(20) NOT NULL CHECK (aggregate_type IN ('count', 'sum')),
  aggregate_field  VARCHAR(50),
  chart_type       VARCHAR(20) NOT NULL DEFAULT 'bar' CHECK (chart_type IN ('bar', 'line', 'table')),
  filters          JSONB NOT NULL DEFAULT '[]',
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CHECK ((aggregate_type = 'sum' AND aggregate_field IS NOT NULL) OR (aggregate_type = 'count' AND aggregate_field IS NULL))
);

ALTER TABLE report_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_report_definitions ON report_definitions
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');
