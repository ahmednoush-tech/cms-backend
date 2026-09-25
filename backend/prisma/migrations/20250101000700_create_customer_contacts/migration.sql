-- ============================================================
-- 008_create_customer_contacts.sql
-- ============================================================

CREATE TABLE customer_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    job_title       VARCHAR(150),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
