-- ============================================================
-- 010_create_leads.sql
-- converted_at/converted_by/customer_id capture the Lead ->
-- Customer conversion. The lead row is never deleted on
-- conversion; it remains as historical provenance.
-- ============================================================

CREATE TABLE leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    company_name    VARCHAR(255),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    source          VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','contacted','qualified','proposal','won','lost')),
    owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    notes           TEXT,
    converted_at    TIMESTAMPTZ,
    converted_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT chk_lead_conversion CHECK (
        (converted_at IS NULL AND customer_id IS NULL)
        OR (converted_at IS NOT NULL AND customer_id IS NOT NULL)
    )
);
