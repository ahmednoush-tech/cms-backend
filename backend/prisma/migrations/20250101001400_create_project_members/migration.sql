-- ============================================================
-- 015_create_project_members.sql
-- Many-to-many: projects <-> employees.
-- ============================================================

CREATE TABLE project_members (
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    role            VARCHAR(50) NOT NULL, -- Project Manager, Coordinator, Technician, QA, Support
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, employee_id)
);
