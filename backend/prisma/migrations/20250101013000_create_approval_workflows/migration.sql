-- ============================================================
-- 091_create_approval_workflows.sql
--
-- GENERIC APPROVAL WORKFLOW ENGINE
--
-- DELIBERATE SAFETY BOUNDARY: this engine is PURE STATE TRACKING.
-- Approving a request changes ONLY that request's own status/step
-- — it never itself deducts a balance, creates a journal entry,
-- disburses anything, or executes ANY business action. A feature
-- that wants "don't proceed until approved" must explicitly query
-- an approval_request's status itself and act on it; this engine
-- has no callback/webhook/action-execution mechanism, on purpose.
-- Building a generic "execute arbitrary business logic on
-- approval" engine would mean either a dangerous arbitrary-code
-- path or another large, entity-specific registry (like the
-- reports engine's) for every possible side effect — neither is
-- built here. This keeps the engine safe by having literally
-- nothing dangerous it CAN do.
--
-- approval_workflows: a company-defined named chain (e.g.
-- "Purchases over 10,000 SAR"), made of ordered steps.
--
-- approval_workflow_steps: each step names an APPROVER ROLE (not
-- a specific user) — whoever currently holds that role in the
-- company can act on a request sitting at that step. Validated
-- against this company's real roles at creation time (see
-- ApprovalWorkflowsService), never an arbitrary string.
--
-- approval_requests: NOT linked to any specific system entity —
-- deliberately a standalone "approval ticket" (title +
-- description, optionally a numeric amount for context), so this
-- works for genuinely any internal process without needing a
-- polymorphic entity registry. A future feature wanting tighter
-- integration can still reference an approval_requests.id from
-- its own table if it chooses to.
--
-- approval_actions: the full audit trail — every approve/reject
-- decision, by whom, at which step, with an optional comment.
-- Immutable once written (no update/delete path is exposed).
-- ============================================================

CREATE TABLE approval_workflows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id),
  name        VARCHAR(150) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE approval_workflow_steps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
  step_order        INTEGER NOT NULL,
  approver_role_id  UUID NOT NULL REFERENCES roles(id),
  UNIQUE (workflow_id, step_order)
);

CREATE TABLE approval_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id),
  workflow_id       UUID NOT NULL REFERENCES approval_workflows(id),
  title             VARCHAR(200) NOT NULL,
  description       TEXT,
  amount            DECIMAL(14, 2),
  requested_by      UUID NOT NULL REFERENCES users(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  current_step_order INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE approval_actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_order        INTEGER NOT NULL,
  actor_id          UUID NOT NULL REFERENCES users(id),
  decision          VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'rejected')),
  comments          TEXT,
  actioned_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_requests_status ON approval_requests(company_id, status);
CREATE INDEX idx_approval_actions_request ON approval_actions(request_id);

ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_approval_workflows ON approval_workflows
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE approval_workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_approval_workflow_steps ON approval_workflow_steps
  USING (
    workflow_id IN (SELECT id FROM approval_workflows WHERE company_id = current_setting('app.current_company_id', true)::uuid)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_approval_requests ON approval_requests
  USING (company_id = current_setting('app.current_company_id', true)::uuid OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_approval_actions ON approval_actions
  USING (
    request_id IN (SELECT id FROM approval_requests WHERE company_id = current_setting('app.current_company_id', true)::uuid)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
