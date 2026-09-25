-- ============================================================
-- 047_create_time_entries.sql
--
-- Time Tracking. Logs hours against a Task (the most granular
-- work unit — both Projects and Work Orders already have Tasks
-- under them, so a Task-level entry naturally rolls up to
-- either). hourly_rate_snapshot is frozen from the employee's
-- CURRENT hourly_rate at the moment the entry is created — a
-- later change to that employee's rate never rewrites the cost of
-- hours already logged, the same "freeze at creation" rule used
-- for payslips and invoice line prices throughout this system.
--
-- Deliberately ordinary CRUD (update/delete both allowed) rather
-- than the immutable-once-posted pattern used for financial
-- documents: a time entry is operational data being corrected
-- for accuracy, not a financial transaction with its own audit
-- trail requirement.
-- ============================================================

CREATE TABLE time_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  task_id               UUID NOT NULL REFERENCES tasks(id),
  employee_id           UUID NOT NULL REFERENCES employees(id),
  entry_date            DATE NOT NULL,
  hours                 NUMERIC(6,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  hourly_rate_snapshot  NUMERIC(10,2),
  labor_cost            NUMERIC(12,2),
  notes                 TEXT,
  billable              BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE INDEX idx_time_entries_company_id ON time_entries(company_id);
CREATE INDEX idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX idx_time_entries_employee_id ON time_entries(employee_id);
