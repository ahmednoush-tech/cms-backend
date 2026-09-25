-- ============================================================
-- 003_create_users.sql
--
-- CORRECTION APPLIED: users does NOT carry employee_id.
-- The User <-> Employee relationship is expressed in one
-- direction only, from employees.user_id -> users.id
-- (see 004_create_employees.sql), avoiding a circular FK.
--
-- Resulting model: User 1 -> 0..1 Employee
-- A user with no matching employees row is a customer-portal
-- user (see 009_create_customer_users.sql) or, in future
-- phases, a supplier-portal user.
--
-- users also never carries customer_id. Customer-portal access
-- is granted exclusively via customer_users.
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    phone           VARCHAR(50),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','locked')),
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_users_email UNIQUE (email)
);
