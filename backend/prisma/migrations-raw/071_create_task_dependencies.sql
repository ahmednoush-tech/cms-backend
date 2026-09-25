-- ============================================================
-- 071_create_task_dependencies.sql
--
-- Task dependencies — what actually makes a Gantt chart a Gantt
-- chart rather than just a bar chart of date ranges. Scoped to
-- FINISH-TO-START only (the dependency task cannot start until the
-- one it depends on finishes) — the overwhelmingly common case.
-- START-to-start, finish-to-finish, and lag/lead time are NOT
-- modeled here.
--
-- Self-dependency (a task depending on itself) is rejected at the
-- database level via a CHECK constraint. CIRCULAR dependencies
-- (A depends on B depends on A) are NOT something a CHECK
-- constraint can express — SQL has no native way to validate a
-- transitive graph cycle at insert time — so that validation is
-- done at the application layer (see TasksService.addDependency()).
-- ============================================================

CREATE TABLE task_dependencies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID NOT NULL REFERENCES tasks(id),
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id),
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (task_id != depends_on_task_id),
  UNIQUE (task_id, depends_on_task_id)
);
CREATE INDEX idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends_on_task_id ON task_dependencies(depends_on_task_id);

-- ---- Row-Level Security (same pattern as migrations 064/066/068) ----
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON task_dependencies
  USING (
    task_id IN (SELECT id FROM tasks WHERE company_id = current_setting('app.current_company_id', true)::uuid)
    OR current_setting('app.bypass_rls', true) = 'on'
  );
