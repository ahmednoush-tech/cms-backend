-- ============================================================
-- 076_create_automation_rules.sql
--
-- CRM workflow automation — DELIBERATELY SCOPED to a single
-- action type: notifying the record's owner. A "create a task"
-- action was considered and rejected for this version: Task has a
-- CHECK constraint (chk_task_parent, migration 017) requiring
-- project_id OR work_order_id — Leads and Opportunities have
-- neither, so a bare task tied to them isn't something this
-- schema can represent without a separate, larger change.
--
-- EXECUTION MODEL: rules run SYNCHRONOUSLY, in-process, at the
-- exact point the triggering action already happens in
-- LeadsService.create() / OpportunitiesService.updateStage() —
-- see AutomationRuleEngineService. There is no event bus or
-- message queue; this is a direct function call embedded in the
-- existing write path, the same way ActivityLogService already
-- gets called from those same methods.
--
-- trigger_to_stage is only meaningful when trigger_event =
-- 'stage_changed' — NULL for the 'created' trigger.
-- ============================================================

CREATE TABLE automation_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  name                  VARCHAR(200) NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  trigger_entity_type   VARCHAR(20) NOT NULL CHECK (trigger_entity_type IN ('lead', 'opportunity')),
  trigger_event         VARCHAR(20) NOT NULL CHECK (trigger_event IN ('created', 'stage_changed')),
  trigger_to_stage      VARCHAR(50),
  notification_title    VARCHAR(200) NOT NULL,
  notification_message  TEXT,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_stage_trigger_consistency CHECK (
    (trigger_event = 'stage_changed' AND trigger_to_stage IS NOT NULL) OR
    (trigger_event = 'created' AND trigger_to_stage IS NULL)
  )
);
CREATE INDEX idx_automation_rules_company_id ON automation_rules(company_id);
CREATE INDEX idx_automation_rules_lookup ON automation_rules(company_id, trigger_entity_type, trigger_event, is_active);

-- ---- Row-Level Security (same pattern as prior migrations) ----
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON automation_rules
  USING (
    company_id = current_setting('app.current_company_id', true)::uuid
    OR current_setting('app.bypass_rls', true) = 'on'
  );
