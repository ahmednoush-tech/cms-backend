-- ============================================================
-- 002_create_departments.sql
-- manager_id will reference employees.id, added later in
-- 005_add_deferred_fks.sql once the employees table exists.
-- ============================================================

CREATE TABLE departments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    manager_id      UUID, -- FK added in 005_add_deferred_fks.sql -> employees(id)
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
