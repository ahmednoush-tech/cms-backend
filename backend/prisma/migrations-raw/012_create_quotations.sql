-- ============================================================
-- 012_create_quotations.sql
-- ============================================================

CREATE TABLE quotations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    opportunity_id      UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    quotation_number    VARCHAR(50) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','sent','accepted','rejected','expired')),
    subtotal            NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount            NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax                 NUMERIC(14,2) NOT NULL DEFAULT 0,
    total                NUMERIC(14,2) NOT NULL DEFAULT 0,
    valid_until          DATE,
    created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ,
    CONSTRAINT uq_quotation_number_per_company UNIQUE (company_id, quotation_number)
);
