-- ============================================================
-- 016_create_work_orders.sql
-- assigned_to_employee_id references employees.id explicitly
-- (renamed from the earlier generic assigned_to).
-- ============================================================

CREATE TABLE work_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    customer_id             UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    work_order_number       VARCHAR(50) NOT NULL,
    title                   VARCHAR(255) NOT NULL,
    description             TEXT,
    priority                VARCHAR(10) NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('low','medium','high','urgent')),
    status                  VARCHAR(20) NOT NULL DEFAULT 'new'
                            CHECK (status IN ('new','assigned','in_progress','on_hold','completed','cancelled')),
    assigned_to_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    due_date                DATE,
    created_by              UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at            TIMESTAMPTZ,
    deleted_at              TIMESTAMPTZ,
    CONSTRAINT uq_work_order_number_per_company UNIQUE (company_id, work_order_number)
);
