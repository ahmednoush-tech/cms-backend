-- ============================================================
-- 001_create_companies.sql
-- Tenant root table. Every business table hangs off company_id.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- provides gen_random_uuid()

CREATE TABLE companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    legal_name      VARCHAR(255),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    website         VARCHAR(255),
    logo            VARCHAR(500),
    address         VARCHAR(500),
    city            VARCHAR(100),
    country         VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','suspended')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
