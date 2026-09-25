-- ============================================================
-- 011_create_opportunities.sql
-- stage is the sole state field (no separate status column).
-- "Open opportunities" = stage NOT IN ('won','lost').
-- lead_id is optional traceability back to the originating lead.
-- ============================================================

CREATE TABLE opportunities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    lead_id             UUID REFERENCES leads(id) ON DELETE SET NULL,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    value               NUMERIC(14,2) DEFAULT 0,
    currency            VARCHAR(10) DEFAULT 'SAR',
    stage               VARCHAR(30) NOT NULL DEFAULT 'prospecting'
                        CHECK (stage IN ('prospecting','qualification','proposal','negotiation','won','lost')),
    probability         SMALLINT CHECK (probability BETWEEN 0 AND 100),
    expected_close_date DATE,
    owner_id            UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ
);
