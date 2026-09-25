-- ============================================================
-- 049_create_interactions.sql
--
-- Customer Interaction Log. Every call, meeting, email, or note
-- logged against a Customer, Lead, and/or Opportunity — none of
-- which currently have any record of WHEN someone last talked to
-- them or what was said, only a status field. All three links are
-- nullable, but at least one must be set (enforced by the CHECK
-- constraint below) — an interaction logged against nothing would
-- be meaningless.
--
-- Deliberately ordinary CRUD, same reasoning as time_entries:
-- this is operational/relationship data being corrected for
-- accuracy, not a financial transaction needing an immutable
-- audit trail.
-- ============================================================

CREATE TABLE interactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id),
  customer_id       UUID REFERENCES customers(id),
  lead_id           UUID REFERENCES leads(id),
  opportunity_id    UUID REFERENCES opportunities(id),
  type              VARCHAR(20) NOT NULL CHECK (type IN ('call', 'meeting', 'email', 'note', 'other')),
  subject           VARCHAR(200) NOT NULL,
  notes             TEXT,
  interaction_date  TIMESTAMPTZ NOT NULL,
  outcome           VARCHAR(200),
  follow_up_date    DATE,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CHECK (customer_id IS NOT NULL OR lead_id IS NOT NULL OR opportunity_id IS NOT NULL)
);
CREATE INDEX idx_interactions_company_id ON interactions(company_id);
CREATE INDEX idx_interactions_customer_id ON interactions(customer_id);
CREATE INDEX idx_interactions_lead_id ON interactions(lead_id);
CREATE INDEX idx_interactions_opportunity_id ON interactions(opportunity_id);
CREATE INDEX idx_interactions_follow_up_date ON interactions(follow_up_date) WHERE follow_up_date IS NOT NULL;
