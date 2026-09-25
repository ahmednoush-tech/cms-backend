-- ============================================================
-- 014_create_projects.sql
-- ============================================================

CREATE TABLE projects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    opportunity_id      UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    quotation_id        UUID REFERENCES quotations(id) ON DELETE SET NULL,
    project_number      VARCHAR(50) NOT NULL,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'planning'
                        CHECK (status IN ('planning','approved','in_progress','on_hold','completed','cancelled')),
    start_date          DATE,
    end_date            DATE,
    project_manager_id  UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT uq_project_number_per_company UNIQUE (company_id, project_number)
);
