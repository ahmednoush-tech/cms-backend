-- ============================================================
-- 087_create_performance_evaluations.sql
--
-- PERFORMANCE EVALUATION
--
-- performance_cycles: a company-defined review period (e.g. "Q1
-- 2026", "Annual Review 2026"). status lets HR close a cycle once
-- review season is over, preventing new evaluations against it.
--
-- performance_criteria: reusable rating dimensions (e.g.
-- "Communication", "Technical Skills") — defined once per company,
-- reused across every cycle and evaluation, not redefined per
-- cycle. deleted_at (soft delete) rather than removal, since a
-- criterion referenced by past evaluation_scores must remain
-- readable in that historical context even after being retired
-- from future use.
--
-- performance_evaluations: one review of one employee for one
-- cycle, by one evaluator (a User — evaluators are managers/HR
-- staff with actual login access, unlike the employee being
-- reviewed). UNIQUE(cycle_id, employee_id): exactly one evaluation
-- per employee per cycle, not several competing ones.
--
-- overall_rating is a SNAPSHOT, computed as the unweighted average
-- of that evaluation's own scores at the moment it is finalized —
-- not a live-recalculated value. If a criterion is later
-- deactivated or a company changes its criteria set, past finalized
-- evaluations' overall_rating must not silently shift; it reflects
-- what was actually scored at the time. This is also a disclosed
-- scope decision: criteria are NOT weighted in this version (every
-- criterion counts equally toward the average) — a genuinely
-- weighted scoring model is a reasonable future enhancement, not
-- built here.
--
-- STATUS WORKFLOW: draft -> finalized. There is no employee
-- acknowledgment step, matching this system's established
-- "no employee self-service login" design (see leave-management's
-- migration 084) — an employee cannot log in to see or acknowledge
-- their own review in this version.
-- ============================================================

CREATE TABLE performance_cycles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id),
  name        VARCHAR(150) NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE TABLE performance_criteria (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id),
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  UNIQUE (company_id, name)
);

CREATE TABLE performance_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  cycle_id        UUID NOT NULL REFERENCES performance_cycles(id),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  evaluator_id    UUID NOT NULL REFERENCES users(id),
  overall_comments TEXT,
  overall_rating  DECIMAL(3, 2),
  status          VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  finalized_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);

CREATE TABLE performance_evaluation_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id   UUID NOT NULL REFERENCES performance_evaluations(id) ON DELETE CASCADE,
  criterion_id    UUID NOT NULL REFERENCES performance_criteria(id),
  score           SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comments        TEXT,
  UNIQUE (evaluation_id, criterion_id)
);

CREATE INDEX idx_performance_evaluations_employee ON performance_evaluations(employee_id);
CREATE INDEX idx_performance_evaluations_cycle ON performance_evaluations(company_id, cycle_id);

ALTER TABLE performance_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_performance_cycles ON performance_cycles
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE performance_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_performance_criteria ON performance_criteria
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE performance_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_performance_evaluations ON performance_evaluations
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');

-- performance_evaluation_scores has no company_id of its own (a
-- child row of performance_evaluations) — isolated via the SAME
-- proven subquery pattern already used for invoice_items (see
-- migration 064), not left to service-layer checks alone.
ALTER TABLE performance_evaluation_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_performance_evaluation_scores ON performance_evaluation_scores
  USING (
    evaluation_id IN (
      SELECT id FROM performance_evaluations
      WHERE company_id = current_setting('app.current_company_id', true)::uuid
    )
    OR current_setting('app.bypass_rls', true) = 'on'
  );
