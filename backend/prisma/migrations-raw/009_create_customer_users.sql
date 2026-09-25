-- ============================================================
-- 009_create_customer_users.sql
--
-- Customer Portal access path:
--   User -> Customer User -> Customer
--
-- CORRECTIONS APPLIED:
--   - company_id added (tenant isolation must not depend on
--     joining through customers to find the tenant)
--   - deleted_at added (soft delete; revoking portal access
--     must not destroy history of who had access)
--
-- Isolation rule (enforced at the API/query layer, not by the
-- schema alone): for a request authenticated as a customer
-- user, resolve this row's customer_id AND company_id from
-- the session, then scope every downstream query to both.
-- customer_id/company_id must never be accepted as
-- client-supplied parameters for this purpose.
-- ============================================================

CREATE TABLE customer_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id      UUID REFERENCES customer_contacts(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_customer_user UNIQUE (customer_id, user_id)
);
