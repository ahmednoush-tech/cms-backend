-- ============================================================
-- 017_create_tasks.sql
-- assigned_to_employee_id references employees.id explicitly
-- (renamed from the earlier generic assigned_to). A task must
-- belong to a project, a work order, or both.
-- ============================================================

CREATE TABLE tasks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    project_id              UUID REFERENCES projects(id) ON DELETE SET NULL,
    work_order_id           UUID REFERENCES work_orders(id) ON DELETE SET NULL,
    title                   VARCHAR(255) NOT NULL,
    description             TEXT,
    assigned_to_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    priority                VARCHAR(10) NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('low','medium','high','urgent')),
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','in_progress','completed','cancelled')),
    start_date              DATE,
    due_date                DATE,
    completed_at            TIMESTAMPTZ,
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    CONSTRAINT chk_task_parent CHECK (project_id IS NOT NULL OR work_order_id IS NOT NULL)
);
