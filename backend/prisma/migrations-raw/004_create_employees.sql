-- ============================================================
-- 004_create_employees.sql
--
-- employees.user_id is the ONLY foreign key expressing the
-- User <-> Employee relationship. UNIQUE(user_id) enforces
-- at most one employee per user (User 1 -> 0..1 Employee).
-- users.employee_id does NOT exist (see 003), eliminating the
-- circular FK that would otherwise exist between users and
-- employees.
-- ============================================================

CREATE TABLE employees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE RESTRICT,
    employee_number VARCHAR(50) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    job_title       VARCHAR(150),
    phone           VARCHAR(50),
    email           VARCHAR(255),
    hire_date       DATE,
    manager_id      UUID REFERENCES employees(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','terminated')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_employee_number_per_company UNIQUE (company_id, employee_number),
    CONSTRAINT uq_employee_user UNIQUE (user_id)
);
