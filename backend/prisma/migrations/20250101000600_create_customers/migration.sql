-- ============================================================
-- 007_create_customers.sql
-- ============================================================

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    customer_type   VARCHAR(20) NOT NULL CHECK (customer_type IN ('company','individual')),
    company_name    VARCHAR(255),
    customer_code   VARCHAR(50) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(50),
    website         VARCHAR(255),
    address         VARCHAR(500),
    city            VARCHAR(100),
    country         VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','blacklisted')),
    owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_customer_code_per_company UNIQUE (company_id, customer_code)
);
