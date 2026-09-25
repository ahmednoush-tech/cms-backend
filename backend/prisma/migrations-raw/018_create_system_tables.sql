-- ============================================================
-- 018_create_system_tables.sql
-- Polymorphic cross-cutting tables. entity_type is DB-CHECK-
-- constrained to the supported set. entity_id existence in the
-- corresponding table must additionally be validated at the
-- application/service layer before insert — Postgres cannot
-- express a conditional FK across multiple target tables.
--
-- NOTE: this migration originally also created an early, narrower
-- "attachments" table here (entity_type limited to 7 types). That
-- table definition has been REMOVED from this file — it was
-- superseded by migration 057's fuller design (14 entity types,
-- randomized stored filenames) before ever being used by any
-- application code, and the two `CREATE TABLE attachments`
-- statements would otherwise conflict outright when migrations
-- are applied in sequence. Migration 057 is the sole source of
-- truth for the attachments table.
-- ============================================================

CREATE TABLE comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    entity_type     VARCHAR(30) NOT NULL
                    CHECK (entity_type IN ('customer','lead','opportunity','quotation','project','work_order','task')),
    entity_id       UUID NOT NULL,
    comment         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activity_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(50) NOT NULL,
    entity_type     VARCHAR(30) NOT NULL
                    CHECK (entity_type IN ('customer','lead','opportunity','quotation','project','work_order','task','employee','user','role')),
    entity_id       UUID NOT NULL,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    message         TEXT,
    entity_type     VARCHAR(30),
    entity_id       UUID,
    is_read         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
